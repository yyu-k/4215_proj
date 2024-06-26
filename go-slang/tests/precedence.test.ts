import { compile_and_run } from "./utils";

describe("Multiplication/Division should have a higher precendence than addition/subtraction", () => {
  test("3 * 5 + 2 should be 17", () => {
    const program1 = "3 * 5 + 2";
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(17);
  });

  test("3 + 5 / 2 should be 5.5", () => {
    const program1 = "3 + 5 / 2";
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(5.5);
  });

  test("3 * 5 - 2 should be 13", () => {
    const program1 = "3 * 5 - 2";
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(13);
  });

  test("3 - 5 / 2 should be 0.5", () => {
    const program1 = "3 - 5 / 2";
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(0.5);
  });

  test("3 + 5 * 2 - 7 + 3 / 6 should be 6.5", () => {
    const program1 = "3 + 5 * 2 - 7 + 3 / 6";
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(6.5);
  });
});

describe("Addition/Subtraction should have a higher precendence than relative operators", () => {
  test("3 + 2 == 1 + 1 should be false", () => {
    const program1 = "3 + 2 == 1 + 1";
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(false);
  });

  test("3 + 7 > 9 - 1 should be true", () => {
    const program1 = "3 + 7 > 9 - 1";
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(true);
  });

  test("4 * 4 >= 32 / 2  should be true", () => {
    const program1 = "4 * 4 >= 32 / 2";
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(true);
  });

  test("3-5 == 3 + -5 should be true", () => {
    const program1 = "3-5 == 3 + -5";
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(true);
  });

  test("4 * 3 + 2 > 2 * 3 + 8 should be false", () => {
    const program1 = "4 * 3 + 2 > 2 * 3 + 8";
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(false);
  });
});

describe("Groups i.e. () have the highest precedence", () => {
  test("(2 + 2) * 3 should be 12", () => {
    const program1 = "(2 + 2) * 3";
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(12);
  });

  test("(14 * 2 >= 2 + 27) == (true == false) should be true", () => {
    const program1 = "(14 * 2 >= 2 + 27) == (true == false)";
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(true);
  });

  test("(3 + 5) * (2 - 7) + 3 / 6 should be -39.5", () => {
    const program1 = "(3 + 5) * (2 - 7) + 3 / 6";
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(-39.5);
  });
});
