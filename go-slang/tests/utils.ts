import { parse, compile_program, run } from "../index";

export function compile_and_run(
  program_str: string,
  timeslice: number = 100,
  heap_size: number = 50000,
  gc: boolean = true,
) {
  const ast = parse(program_str, {});
  const instructions = compile_program(ast);
  const { machines } = run(instructions, { heap_size, timeslice, gc });
  return machines.map((machine) => machine.get_final_output());
}
