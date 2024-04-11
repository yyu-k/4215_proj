import { parser } from "./parser/parser";
import { compile_program } from "./compiler";
import { run } from "./scheduler";

const program_str = `
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
const ast = parser.parse(program_str);
console.log(JSON.stringify(ast.body.stmts, null, 2));
const instructions = compile_program(ast);
console.log(JSON.stringify(instructions, null, 2));
const machines = run(instructions, 50000, 2);

machines.forEach((machine) => {
  const { state, output, final_value } = machine;
  console.log("State:", state);
  console.log("Logged output:", output);
  console.log("Final value:", final_value);
});
