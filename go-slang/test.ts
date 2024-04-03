import { parser } from './parser/parser';
import { compile_program } from './compiler';
import { run } from './scheduler';

const program_str = `{
    const m = Mutex();
    func test(mu, pa) {
        Lock(m);
        2 * 3;
        4 * 6;
        set_head(head(pa) + 1); 
        Unlock(m);
    }
    pa := pair(1,1);
    for i:=0; i<10; i = i+1 {
        go test(m, pa);
    }
    head(pa);
}`;

const ast = parser.parse(program_str)
const instructions = compile_program(ast)
console.log(JSON.stringify(ast.body.stmts, null, 2))
console.log(JSON.stringify(instructions, null, 2))
const machines = run(instructions, 50000, 2)

machines.forEach(machine => {
    const [output, final_value] = machine
    console.log("Logged output:", output)
    console.log("Final value:", final_value)
})
