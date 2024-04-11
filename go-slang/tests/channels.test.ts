import { parser } from "../parser/parser";
import { compile_program } from "../compiler";
import { run } from "../scheduler";

const heap_size = 50000;
const compile_and_run = (program_str: string, time_slice: number = 5) => {
  const ast = parser.parse(program_str);
  const instructions = compile_program(ast);
  return run(instructions, heap_size, time_slice);
};

describe("Unbuffered channels", () => {
  test("Errors when blocking on send without receive", () => {
    const program = `
            chan := Channel()
            chan <- 1
        `;
    expect(() => compile_and_run(program)).toThrow();
  });

  test("Errors when blocking on receive without send", () => {
    const program = `
            chan := Channel()
            <- chan
        `;
    expect(() => compile_and_run(program)).toThrow();
  });

  test("Can be used to wait for a program", () => {
    const result = compile_and_run(`
            func wait_for_program(chan) {
                chan <- 1
                return 1
            }
            chan := Channel()
            go wait_for_program(chan)
            a := <-chan
            display(a)
            2
        `);
    expect(result).toHaveLength(2);
    expect(result[0]).toStrictEqual([[1], 2]);
    expect(result[1]).toStrictEqual([[], 1]);
  });
});
