import { compile_and_run } from "./utils";

const DEFAULT_TIME_SLICE = 100;

describe("Garbage Collector should work", () => {
  test("Program will work if heap size is set to 2200 and gc_flag is set to true", () => {
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
    const result = compile_and_run(program, DEFAULT_TIME_SLICE, 2200, true);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(120);
  });

  test("Program will throw if heap size is set to 2200 and gc_flag is set to false", () => {
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
    const result = compile_and_run(program, DEFAULT_TIME_SLICE, 2200, false);
    expect(result[0].state.state).toStrictEqual("errored");
    expect((result[0].state as any).error.message).toBe(
      "Out of memory and garbage collector turned off",
    );
  });
});
