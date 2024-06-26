import { compile_and_run } from "./utils";

describe("short assignments", () => {
  test("single variables", () => {
    const program = `
      a := 1
      b := 2
      display(a)
      display(b)
      a + b
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([1, 2]);
    expect(result[0].final_value).toStrictEqual(3);
  });

  test("reserved tokens such as go cannot be short assigned", () => {
    const program = `
      go := 20;
      go;
    `;
    const wrapper = () => compile_and_run(program);
    //the parser will fail so the machine won't even start
    expect(wrapper).toThrow();
  });

  test("multiple variables", () => {
    const program = `
      a, b := 1, 2
      display(a)
      display(b)
      a + b
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([1, 2]);
    expect(result[0].final_value).toStrictEqual(3);
  });
});

describe("assignment expressions", () => {
  test("single variables", () => {
    const program = `
      var a int
      var b int
      a = 1
      b = 2
      display(a)
      display(b)
      a + b
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([1, 2]);
    expect(result[0].final_value).toStrictEqual(3);
  });

  test("reserved tokens such as go cannot be declared", () => {
    const program = `
      var go int
      go = 20;
      go;
    `;
    const wrapper = () => compile_and_run(program);
    //the parser will fail so the machine won't even start
    expect(wrapper).toThrow();
  });

  test("multiple variables", () => {
    const program = `
      a, b := 2, 1
      a, b = b, a
      display(a)
      display(b)
      a + b
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([1, 2]);
    expect(result[0].final_value).toStrictEqual(3);
  });
});

describe("multiple array assignments", () => {
  test("pure array assignments", () => {
    const program = `
      x := [10]{}
      x[0], x[1], x[2] = 9, 12, 15
      x[1] + x[2] - x[0]
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].final_value).toStrictEqual(18);
  });

  test("mixed array and variable assignments", () => {
    const program = `
      x := [10]{[10]{}}
      var a int
      a, x[0][0], x[1], x[2] = 9, 12, 15, 18
      a + x[0][0] + x[1] + x[2]
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].final_value).toStrictEqual(54);
  });

  test("assigning to array return result of functions", () => {
    const program = `
      x := [10]{[10]{}}
      func array() {
        return x
      }
      array()[0][0], array()[1] = 1, 2
      x[0][0] + x[1]
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(3);
  });
});
