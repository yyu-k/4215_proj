export class Component {
    tag : string
    constructor(tag : string) {
      this.tag = tag;
    }
  }

export class SequenceComp extends Component {
    stmts : Component[]
//body is expected to be an array of Component objects
    constructor(body : Component[]) {
        super("seq");
        this.stmts = body;
    }
}

export class BlockComp extends Component {
    body : SequenceComp
    //body is expected to be an array of Component objects
    constructor(body : Component[]) {
        super("blk");
        this.body = new SequenceComp(body);
    }
}


export class WhileComp extends Component {
    init : Component | null
    post : Component | null
    pred: Component
    body: BlockComp
    //pred is a expression, body is a block
    constructor (pred, body, init = null, post = null,) {
      super("while")
      this.init = init;
      this.post = post;
      this.pred = pred;
      this.body = body;
    }
  }

export class NameComp extends Component {
  sym : string
  //symbol is a string representing the name
  constructor(sym : string) {
    super("nam");
    this.sym = sym;
  }
}

export class VarComp extends Component {
  sym : string
  expr : Component
  type : string | null
  //sym is the string, expr is a component to be assigned, type is a string? Type is unused
  constructor(sym : string, expr : Component, type : string) {
    super("var")
    this.sym = sym;
    this.expr = expr
    this.type = type
  }
}

export class AppComp extends Component {
  fun : NameComp
  args : Component[]
  //fun is a NameComp representing the function, args is an array of expression components e.g. Literals
  constructor (fun : NameComp, args : Component[]) {
    super("app")
    this.fun = fun;
    this.args = args;
  }
}
