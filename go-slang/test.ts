import { parser } from './parser/parser';
import { compile_program, run } from './vm';

const program_str = `{
const test = "abcd";
display(test);
i := 10;
if 5!=3 {
    display(5);
} else {
    display(10);
}
for i>5 {
    display(i + 3);
    i = i - 1;
}
7 + 2;
(5 - 4) + 2;
3 + 10;
display( 100 - 5 );
func echo(i) {
    display( i + 100 );
}
func test(a,b) {
    return a % b;
}
display(test(30, 71));
go echo(i);
}`;

const ast = parser.parse(program_str)
const instructions = compile_program(ast)
console.log(JSON.stringify(ast.body.stmts, null, 2))
console.log(run(instructions, 50000))
