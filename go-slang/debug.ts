import { parser } from "./parser/parser";
import { compile_program } from "./compiler";
import { run } from "./scheduler";

const program_str = `
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
const ast = parser.parse(program_str);
console.log(JSON.stringify(ast.body.stmts, null, 2));
const instructions = compile_program(ast);
console.log(JSON.stringify(instructions, null, 2));
const machines = run(instructions, 2300, 2);

machines.forEach((machine) => {
  const { state, output, final_value } = machine;
  console.log("State:", state);
  console.log("Logged output:", output);
  console.log("Final value:", final_value);
});
