//Convenience Functions
{
  class Component {
    constructor(tag) {
      this.tag = tag;
    }
  }

  class LitComp extends Component {
    constructor(value) {
      super("Literal");
      this.value = value;
    }
  }

  class SequenceComp extends Component {
    //body is expected to be an array of Component objects
    constructor(body) {
      super("seq");
      this.stmts = body;
    }
  }

  class BlockComp extends Component {
    //body is expected to be an array of Component objects
    constructor(body) {
      super("blk");
      this.body = new SequenceComp(body);
    }
  }

  class CondComp extends Component {
    //pred is expected to be an expression
    //consBlk is expected to be a block
    //altBlk is expected to be a block
    constructor(pred, consBlk, altBlk) {
      super("cond");
      this.pred = pred;
      this.cons = consBlk.body;
      this.alt = altBlk.body;
    }
  }

  class CondBlockComp extends BlockComp {
    //This is a special component used to make implicit blocks for conditional components easier to implement
    //The VM does not use this Component
    //cond is expected to be a CondComp
    constructor(cond, stmt) {
      if (stmt) {
        super([stmt, cond]);
      } else {
        super([cond]);
      }
      this.cond = cond;
    }
  }

  class WhileComp extends Component {
    //pred is a expression, body is a block
    constructor (pred, body) {
      super("while")
      this.init = null;
      this.post = null;
      this.pred = pred;
      this.body = body;
    }
  }

  class BreakContComp extends Component {
    //type is either "break" or "continue"
    constructor (type) {
      super("break_cont");
      this.type = type;
    }
  }

  class NameComp extends Component {
    //symbol is a string representing the name
    constructor(sym) {
      super("nam");
      this.sym = sym;
    }
  }

  class VarComp extends Component {
    //sym is the string, expr is a component to be assigned, type is a string? Type is unused
    constructor(sym, expr, type) {
      super("var")
      this.sym = sym;
      this.expr = expr
      this.type = type
    }
  }
  
  class AppComp extends Component {
    //fun is a NameComp representing the function, args is an array of expression components e.g. Literals
    constructor (fun, args) {
      super("app")
      this.fun = fun;
      this.args = args;
    }
  }

  class ArrayCreateComp extends Component {
    //symbol is a string
    //size is a component
    //initial is an array of Components
    constructor (size, initial = []) {
      super("array_create")
      this.size = size
      this.initial = initial
    }
  }

  class ArrayGetComp extends Component {
    //symbol is a string
    //index is a component
    constructor (symbol, index) {
      super("array_get")
      this.symbol = symbol
      this.index = index
    }
  }

  class ArraySetComp extends Component {
    //symbol is a string
    //index is a Component
    //value is a Component
    constructor (symbol, index, value) {
      super("array_set")
      this.symbol = symbol
      this.index = index
      this.value = value
    }
  }

  function buildBinaryExpression(head, tail) {
    return tail.reduce(function(result, element) {
      return {
        tag: "binop",
        sym: element[1],
        first: result,
        second: element[3]
      };
    }, head);
  }

  function buildNestedIf(head, tail) {
    return tail.reduce(function(result, element) {
      //element is either a CondBlockComp or a BlockComp
      if (element.cond !== undefined) {
        result.cond.alt = element;
      } else {
        result.cond.alt = element.body;
      }
      return element;
    }, head);
  }
}

Program "global program"
    = __ blk:Block __ { return blk }
    / seq:Sequence {
        // Wrap sequence without block into block
        return { tag: "blk", body: seq }
    }

Sequence "list of statements"
    = __ head:Statement tail:(__ Statement)* __ {
        return {
          tag: "seq",
          stmts: [head].concat(tail.flatMap(values => values.filter(value => value !== null)))
        }
    }
    / __ head:Statement? __ {
        return { tag: "seq", stmts: head ? [head] : [] }
    }

Block
    = "{" seq:Sequence? "}" {
        return { tag: "blk", body: seq }
    }

Statement
    = Block
    / IfStatement
    / LoopStatement
    / LoopControlStatement
    / FunctionStatement
    / stmt:ReturnStatement EOS { return stmt }
    / stmt:DeclareAssignStmt EOS { return stmt }
    / stmt:GoStatement EOS { return stmt }
    / stmt:Expression  EOS { return stmt }
    // Allow empty statements
    / ";" __ { return null }

FunctionStatement 
  = FunctionDeclaration 
  / MethodDeclaration

FunctionDeclaration =
    FunctionToken __ symbol:Identifier __ "(" __ params:ExpressionList __ ")" __ body: Block {
        return {
            tag: "fun",
            sym: symbol,
            prms: params.map(x => x.sym),
            body,
        }
    }

MethodDeclaration = 
    FunctionToken __ "(" __ receiver:Identifier __ ")" __ symbol:Identifier __ "(" __ params:ExpressionList __ ")" __ body: Block {
        return {
            tag: "fun",
            sym: symbol,
            prms: [receiver].concat(params.map(x => x.sym)),
            body,
        }
    }

ReturnStatement =
    ReturnToken __ exp:Expression { return {tag : "ret", expr : exp} }

LoopStatement "loops"
  = WhileStatement

SimpleStatement
    = NameDeclaration
    / AssignmentStatement
    / Expression

WhileStatement "while statement" //while is not used in Golang
  = ForToken __
      init:SimpleStatement? __ SEMICOLON __ 
      pred:Expression? __ SEMICOLON __
      post:SimpleStatement? __
    body:Block 
    {
      let while_object;
      //If there is no predicate, the predicate is true (infinite loop)
      if (pred) {
        while_object = new WhileComp(pred, body);
      } else {
        const true_object = new LitComp(true);
        while_object = new WhileComp(true_object, body);
      }
      //the post statement is to be executed at the end of the loop, if it is executed
      if (post) {
        while_object.post = post; 
      }
      //the init is executed once before evaluating the condition
      if (init) {
        while_object.init = init
      }
      return while_object;
    }      
  / ForToken __ pred:Expression __ body:Block {
      return new WhileComp(pred, body);
    }
  / ForToken __  body:Block {
      return new WhileComp(new LitComp(true), body);
    }

LoopControlStatement 
  = BreakStatement
  / ContStatement

BreakStatement
  = BreakToken {return new BreakContComp("break")}

ContStatement
  = ContinueToken {return new BreakContComp("continue")}

IfStatement
  = main:IfBlock
    el:(__ ElseToken __ blk:( IfBlock / Block ){return blk})*
    {
      buildNestedIf(main, el);
      return main;
    }

IfBlock 
    = IfToken __ stmt:(stmt:SimpleStatement __ SEMICOLON __ {return stmt})? 
    __ pred:Expression __ cons:Block 
      {
        const cond = new CondComp(pred, cons, new BlockComp([]));
        if (stmt === undefined) {
          stmt = null;
        }
        return new CondBlockComp(cond, stmt);
      }

DeclareAssignStmt "declaration or assignment"
  = AssignmentStatement
  / NameDeclaration

NameDeclaration "name declaration"
    = ConstantDeclaration
    / VariableDeclaration
    / ShortDeclaration

ConstantDeclaration "const declaration"
    = ConstToken __ symbol:Identifier __ Assmt __ expression:Expression   {
        return {
            tag: "const",
            sym: symbol,
            expr: expression,
        }
    }

VariableDeclaration "var declaration"
    = VarToken __ symbol:Identifier __ type:Identifier? __ Assmt __ expression:Expression   {
        return {
            tag: "var",
            sym: symbol,
            expr: expression,
            type //type is unused
        }
    }
    / VarToken __ symbol:Identifier __ type:ArrayType {
        return new VarComp(symbol, 
                          new ArrayCreateComp(type.size), 
                          "array")
    }
    / VarToken __ symbol:Identifier __ type:BasicType {
      return {
          tag: "var",
          sym: symbol,
          expr: new LitComp(null),
          type //type is unused
      }
    }

ShortDeclaration "short var declaration"
    = symbol:Identifier __ ShortAssmt __ expression:Expression {
        return {
          tag: "var",
          sym: symbol,
          expr: expression,
        }
    }

AssignmentStatement 
  = VariableAssignment
  / ArrayAssignment

VariableAssignment "assignment"
  = symbol:Identifier __ Assmt __ exp:Expression { 
    return {
      tag : 'assmt',
      sym : symbol,
      expr : exp
    } 
  }

ArrayAssignment "array assignment"
  = symbol:Identifier __ "[" __ index:Expression __ "]" __ 
    Assmt __ exp: Expression {
      return new ArraySetComp(symbol, index, exp)
    }

GoStatement "go statement"
    = "go" __ call:CallExpression {
        return {
            tag: "go",
            fun: call.fun,
            args: call.args,
        }
    }

Expression
    = BinaryExpression
    / UnaryExpression
    / CallExpression
    / PrimaryExpression

MultiplicativeExpression
  = head:UnaryExpression 
    tail:(__ mul_op __ UnaryExpression)*
    { return buildBinaryExpression(head, tail); }
  / UnaryExpression

AdditiveExpression
  = head:MultiplicativeExpression
    tail:(__ add_op __ MultiplicativeExpression)*
    { return buildBinaryExpression(head, tail); }
  / MultiplicativeExpression

BinaryExpression
  = head:AdditiveExpression
    tail:(__ rel_op __ AdditiveExpression)*
    { return buildBinaryExpression(head, tail); }
  / AdditiveExpression

UnaryExpression
    = op:UnaryOperator __ e:UnaryExpression {
        return {
            tag: "unop",
            sym: op,
            expr: e
        }
    }
    / CallExpression

CallExpression
    = FunctionCall
    / MethodCall
    / PrimaryExpression

FunctionCall
  = fn:PrimaryExpression __ args:Arguments {
        return { tag: "app", fun: fn, args: args }
    }

MethodCall
  = obj:NameExpression DOT fn:PrimaryExpression __ args:Arguments {
        return { tag: "app", fun: fn, args: [obj].concat(args) }
    }

PrimaryExpression
    = Literal
    / ArrayLiteral
    / ArrayAccess
    / NameExpression
    / "(" __ expr:Expression __ ")" { return expr }

NameExpression
  = ident:Identifier { return { tag: "nam", sym: ident } }

ArrayLiteral "array literal"
  = array:ArrayType __ "{" __ exprs:ExpressionList __"}" {
    return new ArrayCreateComp(array.size, exprs)
  }

ArrayAccess "array access"
  = symbol:Identifier __ "[" __ index:Expression __ "]" {
      return new ArrayGetComp(symbol, index)
    }

Arguments
    = "(" __ exprs:ExpressionList __ ")" { return exprs }

ExpressionList
    = expr:Expression exprs:( __ "," __ exp:Expression {return exp})* {
        return [expr].concat(exprs).filter(x=>x!=null)
      }
    / expr:Expression? {return [expr].filter(x => x!=null)}


//In principle should be unicode letter and unicode digit
Identifier
    = !ReservedWord ident:$( letter ( letter / DecimalDigit )* ) {return ident}

//Added DecimalLiteral
Literal
  = NullLiteral
  / BooleanLiteral
  / DecimalLiteral
  / StringLiteral

//Strings
StringLiteral "string"
  = DQUO chars:(!LineTerminatorSequence char:[^"]{return char})* DQUO {
      return { tag: "Literal", value: chars.join("") };
    }
  / BQUO chars:([^`])* BQUO {
      return { tag: "Literal", value: chars.join("") };
    }
  / SQUO chars:([^']) SQUO {
      return { tag : "Literal", value : chars.charCodeAt(0)}
  }

NullLiteral
  = NullToken { return { tag: "Literal", value: null }; }

BooleanLiteral
  = TrueToken  { return { tag: "Literal", value: true  }; }
  / FalseToken { return { tag: "Literal", value: false }; }


DecimalLiteral
  = DecimalIntegerLiteral "." DecimalDigit* ExponentPart? {
      return { tag: "Literal", value: parseFloat(text()) };
    }
  / "." DecimalDigit+ ExponentPart? {
      return { tag: "Literal", value: parseFloat(text()) };
    }
  / DecimalIntegerLiteral ExponentPart? {
      return { tag: "Literal", value: parseFloat(text()) };
    }

DecimalIntegerLiteral
  = "0"
  / NonZeroDigit DecimalDigit*

DecimalDigit
  = [0-9]

NonZeroDigit
  = [1-9]

ExponentPart
  = ExponentIndicator SignedInteger

ExponentIndicator
  = "e"i

SignedInteger
  = [+-]? DecimalDigit+

HexDigit
  = [0-9a-f]i

letter            "letter"                      
  = [a-zA-ZáàâäãåçéèêëíìîïñóòôöõúùûüýÿæœÁÀÂÄÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸÆŒ]
  / "_"

//Simplified IdentifierPart 
IdentifierPart
  = IdentifierStart
  / letter
  / DecimalDigit

//Simplified IdentifierStart
IdentifierStart
  = "$"
  / "_"
  / "\\"      

// Tokens

BreakToken      = "break"      !IdentifierPart
CaseToken       = "case"       !IdentifierPart
CatchToken      = "catch"      !IdentifierPart
ClassToken      = "class"      !IdentifierPart
ConstToken      = "const"      !IdentifierPart
ContinueToken   = "continue"   !IdentifierPart
DebuggerToken   = "debugger"   !IdentifierPart
DefaultToken    = "default"    !IdentifierPart
DoToken         = "do"         !IdentifierPart
ElseToken       = "else"       !IdentifierPart
EnumToken       = "enum"       !IdentifierPart
ExportToken     = "export"     !IdentifierPart
ExtendsToken    = "extends"    !IdentifierPart
FalseToken      = "false"      !IdentifierPart
FinallyToken    = "finally"    !IdentifierPart
ForToken        = "for"        !IdentifierPart
FunctionToken   = "func"       !IdentifierPart
GetToken        = "get"        !IdentifierPart
IfToken         = "if"         !IdentifierPart
ImportToken     = "import"     !IdentifierPart
InstanceofToken = "instanceof" !IdentifierPart
InToken         = "in"         !IdentifierPart
NewToken        = "new"        !IdentifierPart
NullToken       = "null"       !IdentifierPart
ReturnToken     = "return"     !IdentifierPart
SetToken        = "set"        !IdentifierPart
SuperToken      = "super"      !IdentifierPart
SwitchToken     = "switch"     !IdentifierPart
ThisToken       = "this"       !IdentifierPart
ThrowToken      = "throw"      !IdentifierPart
TrueToken       = "true"       !IdentifierPart
TryToken        = "try"        !IdentifierPart
VarToken        = "var"        !IdentifierPart
WithToken       = "with"       !IdentifierPart

Tokens "tokens"
  = BreakToken 
  / CaseToken       
  / CatchToken      
  / ClassToken      
  / ConstToken      
  / ContinueToken   
  / DebuggerToken   
  / DefaultToken   
  / DoToken         
  / ElseToken       
  / EnumToken       
  / ExportToken     
  / ExtendsToken    
  / FalseToken      
  / FinallyToken    
  / ForToken      
  / FunctionToken   
  / GetToken        
  / IfToken         
  / ImportToken     
  / InstanceofToken 
  / InToken         
  / NewToken        
  / NullToken       
  / ReturnToken     
  / SetToken        
  / SuperToken      
  / SwitchToken     
  / ThisToken       
  / ThrowToken      
  / TrueToken       
  / TryToken        
  / VarToken           
  / WithToken  

ReservedWord "reserved word"
  = Tokens
// Types
BasicType
  = Identifier

ArrayType
  = "[" __ arraySize:Expression __ "]" __ type:BasicType {
    return {
      tag : 'array',
      size : arraySize,
      type : type
    }
  }

// Special Symbols
DOT
  = "."
SEMICOLON
  = ";"

//Quotes
DQUO              "double quote"                
  = "\u0022"        // ""
SQUO              "single quote"                
  = "\u0027"        // ''
BQUO              "back quote/grave accent"     
  = "\u0060"        // ``

LineTerminator
  = [\n\r\u2028\u2029]

LineTerminatorSequence "end of line"
  = "\n"
  / "\r\n"
  / "\r"
  / "\u2028"
  / "\u2029" 

__
  = (WhiteSpace / LineTerminatorSequence)* { return null }


WhiteSpace "whitespace"
  = "\t"
  / "\v"
  / "\f"
  / " "
  / "\u00A0"
  / "\uFEFF"
  / Zs

// Separator, Space
Zs = [\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]

EOS "end of statement"
// Either an explicit semicolon, or a line terminator character
  = WhiteSpace* ";" WhiteSpace*
  / WhiteSpace* (LineTerminatorSequence WhiteSpace*)+

//Binary Operators

mul_op          "multiplication operator"       
  = "*"
  / "/"
  / "%"

add_op          "addition operator"             
  = $("+" ![+=])
  / $("-" ![-=])

rel_op          "comparison operator"           
  = "=="           
  / "!="
  / "<="
  / ">="
  / "<"
  / ">"

Assmt
  = "=" !"="

ShortAssmt      
  = ":="

UnaryOperator
  = $("+" !"=")
  / $("-" !"=")
  / "!"
