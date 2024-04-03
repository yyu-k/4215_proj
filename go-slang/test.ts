import { parser } from './parser/parser';
import { compile_program } from './compiler';
import { run } from './scheduler';

const program_str = `
func add(a, b) {
    return a + b
}
i := 1;;;;; add(10, 15)
`;

const ast = parser.parse(program_str)
console.log(JSON.stringify(ast.body.stmts, null, 2))
const instructions = compile_program(ast)
console.log(JSON.stringify(instructions, null, 2))
const machines = run(instructions, 50000)

machines.forEach(machine => {
    const [output, final_value] = machine
    console.log("Logged output:", output)
    console.log("Final value:", final_value)
})
