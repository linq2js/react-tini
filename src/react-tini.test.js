import tini from "react-tini";

test("All 'on' overloads should work properly", () => {
  tini.clear();

  tini.dispatch(() => ({
    counter1: 0,
    counter2: 0,
    counter3: 0,
    counter4: 0,
    counter5: 0
  }));

  const increase = () => ({ counter1: current => current + 1 });
  const decrease = () => ({ counter1: current => current - 1 });

  tini.on(increase, state => ({
    counter2: () => state.counter1
  }));

  tini.on([
    [
      increase,
      state => ({
        counter3: () => state.counter1
      })
    ],
    [
      decrease,
      state => ({
        counter4: () => state.counter1
      })
    ]
  ]);

  tini.on([increase, decrease], state => ({
    counter5: () => state.counter1
  }));

  tini.dispatch(increase);

  expect(tini.get()).toEqual({
    // counter1 is increased
    counter1: 1,
    // counter2 copies value from counter1 on increase
    counter2: 1,
    // counter3 copies value form counter1 on increase
    counter3: 1,
    // counter4 is not affected
    counter4: 0,
    // counter5 always copies value from counter1
    counter5: 1
  });

  tini.dispatch(decrease);

  expect(tini.get()).toEqual({
    // counter1 is decreased
    counter1: 0,
    // counter2 is not affected
    counter2: 1,
    // counter3 is not affected
    counter3: 1,
    // counter4 copies value from counter1
    counter4: 0,
    // counter5 always copies value from counter1
    counter5: 0
  });
});

test("watcher should work properly", () => {
  tini.clear();

  tini.watch(
    state => state.counter,
    state => ({
      counter: current => current + 1
    })
  );

  tini.dispatch(() => ({
    counter: 1
  }));

  expect(tini.get()).toEqual({
    counter: 2
  });
});
