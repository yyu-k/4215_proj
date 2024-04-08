import { parser } from './parser/parser';
import { compile_program } from './compiler';
import { run } from './scheduler';

const program_str = `{
    z := 0
    for i:=0; i < 10; i = i + 1 {
        if (i != 5) {
            continue
        }
        z = z + 1
    } 
    z
}`;
const ast = parser.parse(program_str)
console.log(JSON.stringify(ast.body.stmts, null, 2))
const instructions = compile_program(ast)
console.log(JSON.stringify(instructions, null, 2))
const machines = run(instructions, 50000, 2)

machines.forEach(machine => {
    const [output, final_value] = machine
    console.log("Logged output:", output)
    console.log("Final value:", final_value)
})
