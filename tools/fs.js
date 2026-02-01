const {promises: fs} = require("fs");
const {join, dirname} = require("path");

module.exports = {
    /**
     * 当你需要你读文本文件内容（例如json、md、txt等文本）的时候，这会非常有用
     * @param {string} file_name 要读取的文件路径
     */
    read_text(file_name) {
        console.log('Read file:', file_name);
        return fs.readFile(join(dirname(__dirname), file_name), 'utf-8').catch(e => '文件不存在或读取失败: ' + e.message);
    },

    /**
     * 当你需要写文本文件内容（例如json、md、txt等文本）的时候，这会非常有用
     * @param {string} file_name 要写入的文件路径
     * @param {string} content 要写入的内容
     */
    write_text(file_name, content) {
        const file = join(dirname(__dirname), file_name);
        return fs.mkdir(dirname(file), {recursive: true})
            .then(() => fs.writeFile(file, content))
            .catch(e => '文件写入失败: ' + e.message);
    },

    /**
     * 当你要获得指定路径下的所有文件和子目录时，这会非常有用。这将返回一个json列表[path1,path2...]
     * @param {string} dir_path 要读取的路径
     * @param {boolean} recursive 是否遍历目录
     */
    list_dir(dir_path, recursive) {
        return fs.readdir(dir_path, {withFileTypes: true, recursive})
            .then(list => list.map(f => ({
                name: f.name,
                dir: f.parentPath,
                path: join(f.parentPath, f.name),
                [f.isFile() ? 'isFile' : 'isDirectory']: true
            })));
    },

	/**
	 * 这是一个测试方法
	 * @param  {object} input 输入
	 * @param {string} input.name 名字
	 * @param {object} shared 共享对象，可以在多次调用中保存状态
	 */
	test(input,shared){
		const {name}=input;
		return `${name},你好`;
	},
}