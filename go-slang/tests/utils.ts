import { parse, compile_program, run } from "../index";

export function compile_and_run(
  program_str: string,
  time_slice: number = 100,
  heap_size: number = 50000,
  gc_flag: boolean = true,
) {
  const ast = parse(program_str, {});
  const instructions = compile_program(ast);
  return run(instructions, heap_size, time_slice, gc_flag);
}
