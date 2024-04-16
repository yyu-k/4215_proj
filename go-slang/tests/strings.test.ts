import { compile_and_run } from "./utils";

describe("Strings should work", () => {
  test('strings defined with " should work', () => {
    const program1 = `
      x := "abc"
      y := "def"
      x + y
    `;
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual("abcdef");
  });

  test("strings defined with ` should work", () => {
    const program1 = `
      x := \`abc\`
      y := \`def\`
      x + y
    `;
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual("abcdef");
  });

  test('String defined with " will throw if there is a new line', () => {
    const program1 = `
      x := "a
      bc"
      y := "def"
      x + y
    `;
    const wrapper = () => compile_and_run(program1);
    expect(wrapper).toThrow();
  });

  test("String defined with ` can have a new line", () => {
    const program1 = `
      x := \`a
bc\`
      y := \`def\`
      x + y
    `;
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual("a\nbcdef");
  });

  test("Char defined with ' is just the char code", () => {
    const program1 = `
      x := 'd'
      x
    `;
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(100);
  });

  test("Char defined with ' cannot have multiple characters", () => {
    const program1 = `
      x := 'da'
      x
    `;
    const wrapper = () => compile_and_run(program1);
    expect(wrapper).toThrow();
  });
});
