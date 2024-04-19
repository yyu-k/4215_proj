import { compile_and_run } from "./utils";

describe("Unbuffered channels", () => {
  test("Errors when blocking on send without receive", () => {
    const program = `
      chan := Channel(0)
      chan <- 1
    `;
    expect(() => compile_and_run(program, 5)).toThrow(
      "Blocked on a send without any matching receive",
    );
  });

  test("Errors when blocking on receive without send", () => {
    const program = `
      chan := Channel(0)
      <- chan
    `;
    expect(() => compile_and_run(program, 5)).toThrow(
      "Blocked on a receive without any matching send",
    );
  });

  test("Can be used to wait for a program", () => {
    const program = `
      func wait_for_program(chan) {
        chan <- 1
        return 1
      }
      chan := Channel(0)
      go wait_for_program(chan)
      a := <-chan
      display(a)
      2
    `;
    const result = compile_and_run(program, 5);
    expect(result).toHaveLength(2);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([1]);
    expect(result[0].final_value).toStrictEqual(2);
    expect(result[1].state.state).toStrictEqual("finished");
    expect(result[1].output).toStrictEqual([]);
    expect(result[1].final_value).toStrictEqual(1);
  });
});

describe("Buffered channels", () => {
  test("Can send without blocking if not full", () => {
    const program = `
      chan := Channel(1)
      chan <- 1
    `;
    const result = compile_and_run(program, 5);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(false);
  });

  test("Errors when blocking on send without receive when full", () => {
    const program = `
      chan := Channel(1)
      chan <- 1
      chan <- 1
    `;
    expect(() => compile_and_run(program, 5)).toThrow(
      "Blocked on a send without any matching receive",
    );
  });

  test("Can send values across goroutines", () => {
    const program = `
      func wait_for_program(done, chan) {
        chan <- 1
        chan <- 1
        done <- 1
      }
      chan, done := Channel(2), Channel(0)
      sum := 0
      go wait_for_program(done, chan)
      sum = sum + <-chan
      sum = sum + <-chan
      <-done
      sum
    `;
    const result = compile_and_run(program, 1);
    expect(result).toHaveLength(2);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(2);
    expect(result[1].state.state).toStrictEqual("finished");
    expect(result[1].output).toStrictEqual([]);
    expect(result[1].final_value).toStrictEqual(false);
  });
});
