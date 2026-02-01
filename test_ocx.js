const {parse} = require('oxc-parser');


const get_identifiers=node=>{
	const rs=[];
	if(node.type==='Identifier')rs.push(node.name);
	else if(node.type==='Literal')rs.push(node.value);
	for(const key of ['object','property'])if(node[key])Array.prototype.push.apply(rs, get_identifiers(node[key]));
	return rs;
}


parse(``, `

Object['assign'](exports, {abc:123});

`, {
	sourceType: 'module',
	attachComments: true,
}).then(ast => {

	const comments = new Set(ast.comments);

	(function walk(node) {
		if (Array.isArray(node.body)) for (const o of node.body) walk(o);
		else if(node?.expression)walk(node.expression);
		else if (node?.type === 'AssignmentExpression' && node?.operator === '=') {
			console.log(get_identifiers(node.left),node.left);
		}else if(node?.type === 'CallExpression'&& get_identifiers(node.callee).join('.')==='Object.assign') {
			for(const arg of node.arguments){
				const name=get_identifiers(arg).join('.');
				console.log('hit',name);
			}
		}


	})(ast.program);


});


module.exports={
	/**
	 * @param {any} option
	 * @param {any} shared
	 */
	test(option,shared){

	},
	a:{
		b:{},

	},
}
