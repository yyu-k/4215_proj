import { parser } from '../parser/parser';
import { compile_program } from '../compiler';
import { run } from '../scheduler';

const heap_size = 50000
const compile_and_run = (program_str : string) => {
    const ast = parser.parse(program_str);
    const instructions = compile_program(ast) ;
    return run(instructions, heap_size)
}

describe('functions should be definable', () => {
    test('func add(a, b) {return a + b;} add(10,15) should give 25', () => {
        const result = compile_and_run(`{
            func add(a, b) {
            return a + b;
            }
            add(10, 15);
        }`)
        expect(result).toHaveLength(1)
        expect(result[0]).toStrictEqual([[], 25]);
    });
});

describe('methods should be definable', () => {
    test('func (i) add(a) {return i + a;} d:=10; d.add(15) should give 25', () => {
        const result = compile_and_run(`{
            func (i) add(a) {
            return i + a;
            }
            d := 10;
            d.add(15);
        }`)
        expect(result).toHaveLength(1)
        expect(result[0]).toStrictEqual([[], 25]);
    });
});
