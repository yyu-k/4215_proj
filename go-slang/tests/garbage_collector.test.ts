import { parser } from "../parser/parser";
import { compile_program } from "../compiler";
import { run } from "../scheduler";

const compile_and_run = (program_str: string, heap_size : number, gc_flag : boolean) => {
  const ast = parser.parse(program_str);
  const instructions = compile_program(ast);
  return run(instructions, heap_size, 100, gc_flag);
};

describe("Garbage Collector should work", () => {
  test("Program will work if heap size is set to 2300 and gc_flag is set to true", () => {
    const program = `
      func fact(n) {
        return fact_iter(n, 1, 1);
      }
      func fact_iter(n, i, acc) {
        if (i > n) {
            return acc;
        } else {
            return fact_iter(n, i + 1, acc * i);
        }
      }
      fact(5);
    `;
    const result = compile_and_run(program, 2300, true);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(120);
  });
  test("Program will throw if heap size is set to 2300 and gc_flag is set to false", () => {
    const program = `
      func fact(n) {
        return fact_iter(n, 1, 1);
      }
      func fact_iter(n, i, acc) {
        if (i > n) {
            return acc;
        } else {
            return fact_iter(n, i + 1, acc * i);
        }
      }
      fact(5);
    `;
    const result = compile_and_run(program, 2300, false);
    expect(result[0].state.state).toStrictEqual("errored");
  });
})
