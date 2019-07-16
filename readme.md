# react-tini

Tiny but powerful state management library

## Counter App

```jsx harmony
import React from "react";
import { render } from "react-dom";
import T from "react-tini";

const Increase = () => {
  return {
    counter: current => current + 1
  };
};

const App = T((props, context) => {
  const counter = context.get(state => state.counter);

  function handleClick() {
    context.dispatch(Increase);
  }

  return (
    <>
      <h1>{counter}</h1>
      <button onClick={handleClick}>Increase</button>
    </>
  );
});

render(<App />, document.getElementById("root"));
```

## Counter App (Compact version)

```jsx harmony
import React from "react";
import { render } from "react-dom";
import T from "react-tini";

const Increase = () => ({
  counter: current => current + 1
});

const App = T((props, { get, dispatch }) => (
  <>
    <h1>{get("counter")}</h1>
    <button onClick={() => dispatch(Increase)}>Increase</button>
  </>
));

render(<App />, document.getElementById("root"));
```

## Counter App (Using state, action mappings)

```jsx harmony
import React from "react";
import { render } from "react-dom";
import T from "react-tini";

const Increase = () => ({
  counter: current => current + 1
});

const App = T(
  {
    states: {
      counter: state => state.counter
    },
    actions: {
      increase: () => [Increase]
    }
  },
  ({ counter, increase }) => (
    <>
      <h1>{counter}</h1>
      <button onClick={increase}>Increase</button>
    </>
  )
);

render(<App />, document.getElementById("root"));
```

## Simple action

```jsx harmony
// action returns multiple state reducers
const Increase = () => ({
  counter: current => current + 1
});

// action returns single state reducer
const Decrease = () => state => ({
  ...state,
  counter: state.counter - 1
});
```

## Dispatching action from other action

```jsx harmony
const Increase = () => ({
  counter: current => current + 1
});

const IncreaseDouble = dispatch => {
  dispatch(Increase);
  dispatch(Increase);
};
```

## Async Action

```jsx harmony
const Fetch = async (dispatch, url, onSuccess, onFailure) => {
  try {
    const res = await fetch(url);
    const json = await res.json();
    onSuccess && dispatch(onSuccess, json);
  } catch (e) {
    onFailure && dispatch(onFailure, e);
  }
};

const ProductLoaded = (_, products) => ({
  products: () => products
});

const LoadProduct = dispatch => {
  dispatch(Fetch, "http://", ProductLoaded);
};
```

## Auto dispatch action

```jsx harmony
import T from "react-tini";

const LoadProduct = (dispatch, category, filter) => {};

const ProductList = T(
  {
    dispatch: () => [LoadProduct]
  },
  () => null
);

// passing component props to action
const ProductListByCategory = T(
  {
    dispatch: ({ props }) => [LoadProduct, props.category]
  },
  () => null
);

// passing state to action
const ProductListByCategoryAndFilter = T(
  {
    dispatch: ({ props, state }) => [LoadProduct, props.category, state.filter]
  },
  () => null
);
```

Remark: An action will re-dispatch once its input arguments changed

## Using T as HOC

```jsx harmony
import React from "react";
import T from "react-tini";

const container = T.compose(
  withSomething1(options),
  withSomething2(options),
  T(options)
);

const wrappedComponent = container(component);
```

## Using T.hoc()

```jsx harmony
const ContainerA = hoc(props => {
  return {
    ...props,
    extraProp: true
  };
});

const ContainerB = hoc((props, Comp) => {
  return (
    <>
      <Comp {...props} extraProp={true} />
      <ExtraComponent />
    </>
  );
});
```

## Handling state change

```jsx harmony
import T from "react-tini";

T.subscribe(action => {
  console.log("action ", action.name, " is dispatched");
});
```

## Accessing state

```jsx harmony
import T from "react-tini";

// whole state
console.log(T.get());

// piece of state
console.log(T.get(state => state.counter));
```
