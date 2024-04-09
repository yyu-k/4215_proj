import { parser } from '../parser/parser';
import { compile_program } from '../compiler';
import { run } from '../scheduler';


const heap_size = 50000
const compile_and_run = (program_str : string, time_slice : number = 5) => {
    const ast = parser.parse(program_str);
    const instructions = compile_program(ast) ;
    return run(instructions, heap_size, time_slice)
}

//For these tests, we need to add nonsense instructions to prevent the machines from completing execution too quickly.
//Otherwise, the "race conditions" become unobservable. 

describe('Mutex and WaitGroups should work', () => {
    test('Without waitgroups, main termininates before subroutines complete the task of adding to head of pair', 
    () => {
        const result = compile_and_run(`
            func test(pa) {
                current_head := pa[0];
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
                pa[0] = new_head; 
            }
            pa := [2]int{1,1};
            for i:=0; i<10; i = i+1 {
                go test(pa);
            }
            pa[0];
        `)
        expect(result).toHaveLength(11); //10 machines + main
        expect(result[0][1]).toBeLessThan(11);
    });
    test('With Waitgroups, main terminates after subroutines complete execution, but the value is lower than expected because of race conditions', 
    () => {
        const result = compile_and_run(`
            wg := WaitGroup();
            func test(pa, wg) {
                current_head := pa[0];
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
                pa[0] = new_head; 
                Done(wg);
            }
            pa := [2]int{1,1};
            for i:=0; i<10; i = i+1 {
                Add(wg);
                go test(pa, wg);
            }
            Wait(wg);
            pa[0];
        `)
        expect(result).toHaveLength(11); //10 machines + main
        expect(result[0][1]).toBeLessThan(11);
    });
    test('With Waitgroups and mutex, the value is exactly what is expected', 
    () => {
        const result = compile_and_run(`
            wg := WaitGroup();
            mu := Mutex();
            func test(pa, wg, mu) {
                Lock(mu);
                current_head := pa[0];
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
                pa[0] = new_head; 
                Unlock(mu);
                Done(wg);
            }
            pa := [2]int{1,1};
            for i:=0; i<10; i = i+1 {
                Add(wg);
                go test(pa, wg, mu);
            }
            Wait(wg);
            pa[0];
        `)
        expect(result).toHaveLength(11); //10 machines + main
        expect(result[0][1]).toEqual(11);
    });
});