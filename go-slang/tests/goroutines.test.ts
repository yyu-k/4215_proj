import { parser } from "../parser/parser";
import { compile_program } from "../compiler";
import { run } from "../scheduler";

const heap_size = 50000;
const compile_and_run = (program_str: string) => {
  const ast = parser.parse(program_str);
  const instructions = compile_program(ast);
  return run(instructions, heap_size);
};

describe("goroutines", () => {
  test("builtin function", () => {
    const result = compile_and_run(`{
            go display(12);
        }`);
    expect(result).toHaveLength(2);
    // TODO: is `false` wrong here?
    expect(result[0]).toStrictEqual([[], false]);
    expect(result[1]).toStrictEqual([[12], 12]);
  });

  // TODO: should we be able to call functions before they are defined?
  test("main machine should end before other machines without synchronization", () => {
    const result = compile_and_run(`{
            func add(a, b) {
                return a + b;
            }
            go add(1, 2);
            add(10, 15);
        }`);
    expect(result).toHaveLength(2);
    expect(result[0]).toStrictEqual([[], 25]);
    expect(result[1]).toStrictEqual([[], false]);
  });
});
