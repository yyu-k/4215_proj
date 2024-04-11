import { parser } from "../parser/parser";
import { compile_program } from "../compiler";
import { run } from "../scheduler";

const heap_size = 50000;
const compile_and_run = (program_str: string) => {
  const ast = parser.parse(program_str);
  const instructions = compile_program(ast);
  return run(instructions, heap_size);
};

describe("Strings should work", () => {
  test('strings defined with " should work', () => {
    const program1 = `
                            x := "abc";
                            y := "def";
                            x + y;
                        `;
    const result = compile_and_run(program1);
    expect(result[0]).toStrictEqual([[], "abcdef"]);
  });
  test("strings defined with ` should work", () => {
    const program1 = `
                        x := \`abc\`;
                        y := \`def\`;
                        x + y;
                        `;
    const result = compile_and_run(program1);
    expect(result[0]).toStrictEqual([[], "abcdef"]);
  });
  test('String defined with " will throw if there is a new line', () => {
    const program1 = `
                            x := "a
                            bc";
                            y := "def";
                            x + y;
                        `;
    const wrapper = () => compile_and_run(program1);
    expect(wrapper).toThrow();
  });
  test("String defined with ` can have a new line", () => {
    const program1 = `
                            x := \`a
bc\`;
                            y := \`def\`;
                            x + y;
                        `;
    const result = compile_and_run(program1);
    expect(result[0][1]).toEqual(`a\nbcdef`);
  });
  test("Char defined with ' is just the char code", () => {
    const program1 = `
                            x := 'd'
                            x;
                        `;
    const result = compile_and_run(program1);
    expect(result[0]).toStrictEqual([[], 100]);
  });
  test("Char defined with ' cannot have multiple characters", () => {
    const program1 = `
                            x := 'da'
                            x;
                        `;
    const wrapper = () => compile_and_run(program1);
    expect(wrapper).toThrow();
  });
});
