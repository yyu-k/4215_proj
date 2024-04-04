import { parser } from './parser/parser';
import { compile_program } from './compiler';
import { run } from './scheduler';

const program_str = `{
    const m = Mutex();
    const w = WaitGroup();
    func test(mu, pa, wg) {
        Lock(mu);
        current_head := head(pa);
        2 * 3;
        4 * 6;
        7 * 9;
        6 * 11;
        2 * 3;
        4 * 6;
        7 * 9;
        6 * 11;
        2 * 3;
        4 * 6;
        7 * 9;
        6 * 11;
        2 * 3;
        4 * 6;
        7 * 9;
        6 * 11;
        new_head := current_head + 1;
        2 * 3;
        4 * 6;
        7 * 9;
        6 * 11;
        2 * 3;
        4 * 6;
        7 * 9;
        6 * 11;
        2 * 3;
        4 * 6;
        7 * 9;
        6 * 11;
        2 * 3;
        4 * 6;
        7 * 9;
        6 * 11;
        set_head(pa, new_head); 
        Unlock(mu);
        Done(wg);
    }
    pa := pair(1,1);
    for i:=0; i<10; i = i+1 {
        Add(w);
        go test(m, pa, w);
    }
    Wait(w);
    display(head(pa));
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
