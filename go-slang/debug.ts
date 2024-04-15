import { parser } from "./parser/parser";
import { compile_program } from "./compiler";
import { run } from "./scheduler";

const program_str = `{
    wg := WaitGroup();
    func test(pa, wg) {
        current_head := head(pa);
        2 * 3;
        4 * 6;
        7 * 9;
        6 * 11;
        2 * 3;
        4 * 6;
        new_head := current_head + 1;
        2 * 3;
        4 * 6;
        7 * 9;
        6 * 11;
        2 * 3;
        4 * 6;
        7 * 9;
        set_head(pa, new_head); 
        Done(wg);
    }
    pa := pair(1,1);
    for i:=0; i<10; i = i+1 {
        Add(wg);
        go test(pa, wg);
    }
    Wait(wg);
    head(pa);
}`;
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
