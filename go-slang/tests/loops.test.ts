import { parser } from "../parser/parser";
import { compile_program } from "../compiler";
import { run } from "../scheduler";

const heap_size = 50000;
const compile_and_run = (program_str: string) => {
  const ast = parser.parse(program_str);
  const instructions = compile_program(ast);
  return run(instructions, heap_size);
};

describe("for loops with init statement, condition, and post statement should work", () => {
  test("adding a number every loop", () => {
    const result = compile_and_run(`
      x := 0
      for i:=0; i<10; i = i + 1 {
        x = x + 1
      }
      x
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(10);
  });

  test("For loop can have an empty body", () => {
    const result = compile_and_run(`
      x := 0
      for i:=0; i<10; i = i + 1 {
      }
      x
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(0);
  });
});

describe("for loops with init statement, condition, and no post statement should work", () => {
  test("adding to init variable within the for loop instead of using the post statement", () => {
    const result = compile_and_run(`
      x := 0
      for i:=0; i<10; {
        x = x + 1
        i = i + 2
      }
      x
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(5);
  });
});

describe("for loops with condition, no init statement and no post statement should work", () => {
  test("condition only, 2 semicolons", () => {
    const result = compile_and_run(`
      x := 0
      i := 0
      for ;i<10; {
        x = x + 1
        i = i + 2
      }
      x
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(5);
  });

  test("condition only, no semicolons", () => {
    const result = compile_and_run(`
      x := 0
      i := 0
      for i<10 {
        x = x + 1
        i = i + 2
      }
      x
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(5);
  });
});

describe("variables declared by the init statement should not be accessible outside the loop", () => {
  test("attempting to access variables declared by the init statement should throw", () => {
    const program1 = `
      x := 0
      for i:=0; i<10; i = i + 1 {
        x = x + 1
      }
      i
    `;
    const wrapper = () => compile_and_run(program1);
    expect(wrapper).toThrow(TypeError);
  });
});

describe("breaks should work", () => {
  test("Nesting break in if", () => {
    const result = compile_and_run(`
      x := 0
      for i :=0; i<5; i = i + 1 {
        if (i == 3) {
          break
        }
        x = x + 1
      }
      x
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(3);
  });
});

describe("continue should work", () => {
  test("Nesting continue in if", () => {
    const result = compile_and_run(`
      x := 0
      for i :=0; i<5; i = i + 1 {
        if (i <= 3) {
          continue
        }
        x = x + 1
      }
      x
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(1);
  });
});

describe("Infinite loops should work", () => {
  test("for loops with no init, condition or post are infinite loops which must be stopped by break", () => {
    const result = compile_and_run(`
      x := 0
      for {
        x = x + 1
        if (x == 10) {
          break
        }
      }
      x
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(10);
  });

  test("for loops with no condition is an infinite loop which must be stopped by break", () => {
    const result = compile_and_run(`
      x := 0
      for y := 0; ; y = y + 1 {
        x = x + 2
        if (y == 9) {
          break
        }
      }
      x
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(20);
  });
});
