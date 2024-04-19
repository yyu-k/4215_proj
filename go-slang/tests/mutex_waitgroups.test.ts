import { compile_and_run } from "./utils";

//For these tests, we need to add nonsense instructions to prevent the machines from completing execution too quickly.
//Otherwise, the "race conditions" become unobservable.

describe("Mutex and WaitGroups should work", () => {
  test("Without waitgroups, main termininates before subroutines complete the task of adding to head of pair", () => {
    const program = `
      func test(pa) {
        current_head := pa[0];
        2 * 3;
        4 * 6;
        7 * 9;
        6 * 11;
        2 * 3;
        4 * 6;
        new_head := current_head + 1;
        2 * 3;
        4 * 6;
        7 * 9;
        6 * 11;
        2 * 3;
        4 * 6;
        7 * 9;
        pa[0] = new_head;
      }
      pa := [2]int{1,1};
      for i:=0; i<10; i = i+1 {
        go test(pa);
      }
      pa[0];
    `;
    const result = compile_and_run(program, 5);
    expect(result).toHaveLength(11); //10 machines + main
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toBeLessThan(11);
  });

  test("With Waitgroups, main terminates after subroutines complete execution, but the value is lower than expected because of race conditions", () => {
    const program = `
      wg := WaitGroup()
      func test(pa, wg) {
        current_head := pa[0]
        2 * 3
        4 * 6
        7 * 9
        6 * 11
        2 * 3
        4 * 6
        new_head := current_head + 1
        2 * 3
        4 * 6
        7 * 9
        6 * 11
        2 * 3
        4 * 6
        7 * 9
        pa[0] = new_head
        Done(wg)
      }
      pa := [2]int{1,1}
      for i:=0; i<10; i = i+1 {
        Add(wg)
        go test(pa, wg)
      }
      Wait(wg)
      pa[0]
    `;
    const result = compile_and_run(program, 5);
    expect(result).toHaveLength(11); //10 machines + main
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toBeLessThan(11);
  });

  test("With Waitgroups and mutex, the value is exactly what is expected", () => {
    const program = `
      wg := WaitGroup()
      mu := Mutex()
      func test(pa, wg, mu) {
        Lock(mu)
        current_head := pa[0]
        2 * 3
        4 * 6
        7 * 9
        6 * 11
        2 * 3
        4 * 6
        new_head := current_head + 1
        2 * 3
        4 * 6
        7 * 9
        6 * 11
        2 * 3
        4 * 6
        7 * 9
        pa[0] = new_head
        Unlock(mu)
        Done(wg)
      }
      pa := [2]int{1,1}
      for i:=0; i<10; i = i+1 {
        Add(wg)
        go test(pa, wg, mu)
      }
      Wait(wg)
      pa[0]
    `;
    const result = compile_and_run(program, 5);
    expect(result).toHaveLength(11); //10 machines + main
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(11);
    for (let i = 1; i < 11; i++) {
      expect(result[i].state.state).toStrictEqual("finished");
      expect(result[i].output).toStrictEqual([]);
      expect(result[i].final_value).toStrictEqual(undefined);
    }
  });
});
