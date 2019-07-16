import {
  memo,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  createElement
} from "react";

let context = {
  scopes: 0,
  state: {},
  subscribers: new Set(),
  watchers: new Set(),
  actionListeners: new Set(),
  isActionListenerCalling: false
};

const cachedSelectors = {};

let uniqueId = 1;

function dispatch(action, ...args) {
  if (context.isCallingReducer) {
    throw new Error("Invalid action call");
  }

  if (Array.isArray(action)) {
    return dispatch(
      action[0],
      ...action.slice(1).map(resolver => resolver(context.state))
    );
  }

  if (action.__subscribers) {
    for (const subscriber of action.__subscribers) {
      context.actionListeners.add(subscriber);
    }
  }

  try {
    context.scopes++;
    const result = context.isActionListenerCalling
      ? action(context.state)
      : action(dispatch, ...args);

    if (result) {
      // do not process async result
      if (result.then) return result;

      if (typeof result === "function") {
        const nextState = callReducer(result, context.state);
        if (nextState !== context.state) {
          context.state = nextState;
          context.hasChange = true;
        }
      } else {
        let nextState = context.state;
        Object.entries(result).forEach(([key, reducer]) => {
          const prevValue = nextState[key];
          const nextValue =
            typeof reducer === "function"
              ? callReducer(reducer, prevValue)
              : reducer;
          if (nextValue !== prevValue) {
            if (nextState === context.state) {
              nextState = {
                ...context.state
              };
            }
            nextState[key] = nextValue;
          }
        });

        if (nextState !== context.state) {
          context.state = nextState;
          context.hasChange = true;
        }
      }
    }
  } finally {
    context.scopes--;

    if (!context.scopes) {
      if (!context.isActionListenerCalling) {
        context.isActionListenerCalling = true;
        try {
          const actionListeners = context.actionListeners;
          context.actionListeners = new Set();
          for (const listener of actionListeners) {
            dispatch(listener);
          }

          for (const watcher of context.watchers) {
            let hasChange = false;
            for (const selector of watcher.__selectors) {
              const currentValue = selector(context.state);
              if (selector.__prevValue !== currentValue) {
                selector.__prevValue = currentValue;
                hasChange = true;
              }
            }
            if (hasChange) {
              dispatch(watcher);
            }
          }
        } finally {
          context.isActionListenerCalling = false;
        }
      }

      if (context.hasChange) {
        context.hasChange = false;
        notify(action);
      }
    }
  }
}

function callReducer(reducer, state) {
  context.isCallingReducer = true;
  try {
    return reducer(state);
  } finally {
    context.isCallingReducer = false;
  }
}

function subscribe(subscriber) {
  context.subscribers.add(subscriber);

  return () => context.subscribers.delete(subscriber);
}

function notify(modifier) {
  for (const subscriber of context.subscribers) {
    subscriber(modifier);
  }
}

function addToSet(set, obj) {
  if (!obj.__id) {
    obj.__id = uniqueId++;
  }

  set[obj.__id] = obj;
  return obj.__id;
}

function getSelector(selector) {
  if (typeof selector === "function") return selector;

  return (cachedSelectors[selector] = state => state[selector]);
}

function get(selector) {
  if (!arguments.length) return context.state;
  return getSelector(selector)(context.state);
}

function init(state = {}) {
  let nextState = context.state;
  Object.entries(state).forEach(([key, value]) => {
    if (key in context.state) return;
    if (nextState === context.state) {
      nextState = { ...context.state };
    }
    nextState[key] = value;
  });

  if (nextState !== context.state) {
    context.state = nextState;
    notify(init);
  }
}

export default Object.assign(
  function wrap(...args) {
    // hoc
    if (!args.length || (args.length === 1 && typeof args[0] !== "function")) {
      return x => wrap(args[0], x);
    }

    const component = args.pop();

    const { states, actions, dispatch: dispatchList } = args.pop() || {};
    const stateEntries = states && Object.entries(states);
    const actionEntries = actions && Object.entries(actions);

    return memo(props => {
      const [, forceRerender] = useState();
      const lastErrorRef = useRef();
      const selectorsRef = useRef();
      const prevValuesRef = useRef([]);
      const dispatchArgsRef = useRef([]);
      const propsRef = useRef();
      const getCallback = useMemo(() => {
        const cache = new Map();
        return (key, resolver) => {
          let result = cache.get(key);
          if (!result) {
            cache.set(
              key,
              (result = resolver({
                props: propsRef.current,
                state: context.state
              }))
            );
          }
          return result;
        };
      }, []);
      propsRef.current = props;
      selectorsRef.current = {};
      prevValuesRef.current = {};

      if (lastErrorRef.current) {
        const error = lastErrorRef.current;
        lastErrorRef.current = undefined;
        throw error;
      }

      const get = useCallback(
        selector => {
          selector = getSelector(selector);
          const propId = addToSet(selectorsRef.current, selector);
          return (prevValuesRef.current[propId] = selector(
            context.state,
            propsRef.current
          ));
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [context.state]
      );

      useEffect(() => {
        function checkForUpdates() {
          try {
            const hasChange = Object.entries(selectorsRef.current).some(
              ([key, selector]) => {
                return (
                  prevValuesRef.current[key] !==
                  getSelector(selector)(context.state, propsRef.current)
                );
              }
            );

            if (hasChange) {
              forceRerender({});
            }
          } catch (ex) {
            lastErrorRef.current = ex;
            forceRerender({});
          }
        }

        checkForUpdates();

        return subscribe(checkForUpdates);
      }, []);

      const newProps = useMemo(() => {
        let newProps = propsRef.current;

        if (stateEntries || actionEntries) {
          newProps = {};
          stateEntries &&
            stateEntries.forEach(
              ([key, selector]) => (newProps[key] = get(selector))
            );
          actionEntries &&
            actionEntries.forEach(([key, action]) => {
              newProps[key] = getCallback(key, () => {
                return (...args) =>
                  dispatch(
                    ...[].concat(
                      action(
                        { props: propsRef.current, state: context.state },
                        ...args
                      )
                    )
                  );
              });
            });
          Object.assign(newProps, propsRef.current);
        }
        return newProps;
      }, [get, getCallback]);

      useEffect(() => {
        if (dispatchList && dispatchList.length) {
          dispatchList.forEach((resolver, index) => {
            const prevArgs = dispatchArgsRef.current[index];
            const nextArgs =
              resolver({
                props: propsRef.current,
                state: context.state
              }) || [];
            if (
              typeof prevArgs === "undefined" ||
              !arrayEqual(prevArgs, nextArgs)
            ) {
              dispatchArgsRef.current[index] = nextArgs;
              dispatch(...nextArgs);
            }
          });
        }
      });

      return component(newProps, {
        get,
        dispatch
      });
    });
  },
  {
    dispatch,
    init,
    get,
    subscribe,
    on,
    watch,
    clear,
    hoc,
    compose
  }
);

function clear() {
  dispatch(() => () => ({}));
}

function on(...args) {
  if (context.scopes) {
    throw new Error("Cannot register action listener inside other action call");
  }

  const pairs = [];
  /**
   * on([action1, action2], stateMutator)
   * on(
   *  [action1, stateMutator1],
   *  [action2, stateMutator2]
   * )
   */
  if (Array.isArray(args[0])) {
    /**
     * on([action1, action2], stateMutator)
     */
    if (typeof args[1] === "function") {
      pairs.push(...args[0].map(action => [action, args[1]]));
    } else {
      /**
       * on(
       *  [action1, stateMutator1],
       *  [action2, stateMutator2]
       * )
       */
      pairs.push(...args[0]);
    }
  } else {
    pairs.push(args);
  }

  pairs.forEach(([action, stateMutator]) => {
    if (!action.__subscribers) {
      action.__subscribers = new Set();
    }
    action.__subscribers.add(stateMutator);
  });

  return () => {
    pairs.forEach(([action, stateMutator]) =>
      action.__subscribers.delete(stateMutator)
    );
  };
}

function watch(selector, watcher) {
  context.watchers.add(watcher);
  if (!watcher.__selectors) {
    watcher.__selectors = new Set();
  }
  if (Array.isArray(selector)) {
    selector.forEach(item => watcher.__selectors.add(item));
  } else {
    watcher.__selectors.add(selector);
  }
}

function arrayEqual(a, b) {
  return a.length === b.length && a.every((i, index) => i === b[index]);
}

function compose(...functions) {
  if (functions.length === 0) {
    return arg => arg;
  }

  if (functions.length === 1) {
    return functions[0];
  }

  return functions.reduce((a, b) => (...args) => a(b(...args)));
}

function hoc(...callbacks) {
  return callbacks.reduce(
    (nextHoc, callback) => Component => {
      const MemoComponent = memo(Component);

      return props => {
        // callback requires props and Comp, it must return React element
        if (callback.length > 1) {
          return callback(props, MemoComponent);
        }
        let newProps = callback(props);
        if (newProps === false) return null;
        if (!newProps) {
          newProps = props;
        }

        return createElement(MemoComponent, newProps);
      };
    },
    Component => Component
  );
}
