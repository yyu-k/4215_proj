import { parser } from "../parser/parser";
import { compile_program } from "../compiler";
import { run } from "../scheduler";

const heap_size = 50000;
const compile_and_run = (program_str: string) => {
  const ast = parser.parse(program_str);
  const instructions = compile_program(ast);
  return run(instructions, heap_size);
};

describe("arrays", () => {
  test("Can be declared via var, initialized with null, and accessed", () => {
    const result = compile_and_run(`
      var a[3] string
      a[0]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(null);
  });

  test("Can be declared via short assignment directly using literals", () => {
    const result = compile_and_run(`
      primes := [6]int{2, 3, 5, 7, 11, 13}
      primes[3]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(7);
  });

  test("Can be declared via short assignment directly using expressions", () => {
    const result = compile_and_run(`
      func number() {
        return 200
      }
      nums := [6]int{2, number(), 5, 9, 11 + 7, 13 * 2}
      nums[1]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(200);
  });

  test("Can be declared via short assignment where the number of expressions < size", () => {
    const result = compile_and_run(`
      nums := [6]int{1}
      nums[0]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(1);
  });

  test("Can be assigned to other literals", () => {
    const result = compile_and_run(`
      var a[3] string
      a[0] = "haha"
      a[0]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual("haha");
  });

  test("Can be assigned to other expressions", () => {
    const result = compile_and_run(`
      func add(a, b) {
        return a + b
      }
      var a[3] string
      a[0] = add(3, 7)
      a[0]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(10);
  });

  test("Does not allow access to index outside the size range", () => {
    const result = compile_and_run(`
      func add(a, b) {
        return a + b
      }
      var a[3] string
      a[3] = add(3, 7)
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("errored");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(null);
  });

  test("Allows expressions to be used to define the size", () => {
    const result = compile_and_run(`
      func add(a, b) {
        return a + b
      }
      var a[add(3,2)] string
      a[4] = add(3, 7)
      a[4]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(10);
  });

  test("Indexes can be a variable e.g. in loops", () => {
    const result = compile_and_run(`
      var a[5] string
      for i := 0; i < 5; i = i + 1 {
        a[i] = i * 2
      }
      a[2] + a[3] + a[4]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(18);
  });

  test("can be returned by functions", () => {
    const result = compile_and_run(`
      func array_return(rounds) {
        var a[rounds] string
        for i := 0; i < rounds; i = i + 1 {
          a[i] = i * 2
        }
        return a
      }
      z := array_return(11)
      z[10]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(20);
  });

  test("can be directly accessed as an expression if the expression is bracketed", () => {
    const result = compile_and_run(`
      func array_return(rounds) {
        var a[rounds] string
        for i := 0; i < rounds; i = i + 1 {
          a[i] = i * 2
        }
        return a
      }
      (array_return(11))[10]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(20);
  });
});

describe("Slices", () => {
  test("Can be created from an array with the syntax array[low:high]", () => {
    const result = compile_and_run(`
      numbers := [6]int{0, 1, 2, 3, 4, 5}
      s := numbers[3:6]
      s[0]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(3);
  });

  test("Can be created from an array with the syntax array[low:]", () => {
    const result = compile_and_run(`
      numbers := [6]int{0, 1, 2, 3, 4, 5}
      s := numbers[3:]
      display(s[2])
      s[0]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([5]);
    expect(result[0].final_value).toStrictEqual(3);
  });

  test("Can be created from an array with the syntax array[:high]", () => {
    const result = compile_and_run(`
      numbers := [6]int{0, 1, 2, 3, 4, 5}
      s := numbers[:4]
      display(s[3])
      s[0]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([3]);
    expect(result[0].final_value).toStrictEqual(0);
  });

  test("Can be created from an array with the syntax array[:]", () => {
    const result = compile_and_run(`
      numbers := [6]int{0, 1, 2, 3, 4, 5}
      s := numbers[:]
      display(s[5])
      s[0]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([5]);
    expect(result[0].final_value).toStrictEqual(0);
  });

  test("Can be sliced multiple times", () => {
    //Example from https://go.dev/tour/moretypes/10
    const result = compile_and_run(`
      s := []int{2, 3, 5, 7, 11, 13}
      s = s[1:4]
      s = s[:2]
      s = s[1:]
      s
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual([5]);
  });

  test("Can be created from a slice literal", () => {
    const result = compile_and_run(`
      numbers := []int{8, 9, 10}
      numbers[2]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(10);
  });

  test("Can be created from another slice with the syntax slice[low:high]", () => {
    const result = compile_and_run(`
      numbers := [6]int{0, 1, 2, 3, 4, 5}
      s := numbers[2:6]
      d := s[2:4]
      d[0]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(4);
  });

  test("Can be of length 0", () => {
    //Partly taken from https://go.dev/tour/moretypes/11
    const result = compile_and_run(`
      s := []int{2, 3, 5, 7, 11, 13}
      s = s[:0]
      s
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual([]);
  });

  test("Can be applied to the len_slice function", () => {
    //Partly taken from https://go.dev/tour/moretypes/11
    const result = compile_and_run(`
      s := []int{2, 3, 5, 7, 11, 13}
      display(len_slice(s))
      s = s[:0]
      len_slice(s)
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([6]);
    expect(result[0].final_value).toStrictEqual(0);
  });

  test("Can be applied to the len_cap function", () => {
    //Partly taken from https://go.dev/tour/moretypes/11
    const result = compile_and_run(`
      s := []int{2, 3, 5, 7, 11, 13}
      s = s[1:3]
      cap_slice(s)
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(5);
  });

  test("A longer slice can be created from a shorter slice if the underlying array is long enough", () => {
    const result = compile_and_run(`
      s := []int{2, 3, 5, 7, 11, 13}
      s = s[:0]
      x := s[:4]
      x
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual([2, 3, 5, 7]);
  });

  test("causes changes in the value of other slices when amended", () => {
    const result = compile_and_run(`
      numbers := [6]int{0, 1, 2, 3, 4, 5}
      s := numbers[2:3]
      d := s[0:4]
      d[0] = 9000
      s[0]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(9000);
  });

  test("Can contain other slices", () => {
    const result = compile_and_run(`
      numbers := [6]int{0, 1, 2, 3, 4, 5}
      s := numbers[2:4]
      var d [3]
      d[0] = s
      d[0]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual([2, 3]);
  });

  test("Will throw with the syntax slice[low:high] if the high is too high", () => {
    const result = compile_and_run(`
      numbers := [6]int{0, 1, 2, 3, 4, 5}
      s := numbers[2:6]
      d := s[2:5]
      d[0]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("errored");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(null);
  });

  test("allows for appending, which will utilize the same underlying array if capacity is not exceeded", () => {
    const result = compile_and_run(`
      numbers := [6]int{0, 1, 2, 3, 4, 5}
      s := numbers[1:4]
      d := append(s, 500)
      display(numbers[4])
      d[3]
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([500]);
    expect(result[0].final_value).toStrictEqual(500);
  });

  test("allows for appending, which will utilize a new array if capacity is exceeded", () => {
    const result = compile_and_run(`
      d := []int{2, 3, 5, 7, 11, 13}
      q := d[2:]
      q = append(q, 9000)
      q[0] = -20
      display(q)
      d
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([[-20, 7, 11, 13, 9000]]);
    expect(result[0].final_value).toStrictEqual([2, 3, 5, 7, 11, 13]);
  });

  test("appending should not suffer from off-by-one errors", () => {
    const result = compile_and_run(`
      d := []int{2, 3, 5, 7, 11, 13, 19, 20, 34}
      q := d[2:8]
      display(q)
      q = append(q, 9000)
      q[0] = -20
      display(q)
      display(d)
      q = append(q, 500)
      q[0] = 75
      display(d)
      q
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([
      [5, 7, 11, 13, 19, 20],
      [-20, 7, 11, 13, 19, 20, 9000],
      [2, 3, -20, 7, 11, 13, 19, 20, 9000],
      [2, 3, -20, 7, 11, 13, 19, 20, 9000],
    ]);
    expect(result[0].final_value).toStrictEqual([
      75, 7, 11, 13, 19, 20, 9000, 500,
    ]);
  });
});
