const {promises:fs}=require("fs");
const {join,dirname}=require("path");

module.exports = {
    /**
     * 当你需要你读文件内容的时候，这会非常有用
     * @param {string} file_name 要读取的文件路径
     */
    read_file(file_name) {
        console.log('Read file:',file_name);
        return fs.readFile(join(dirname(__dirname),file_name),'utf-8').catch(e=>'文件不存在或读取失败: ' + e.message);
    },

    /**
     * 当你要获得指定路径下的所有文件和子目录时，这会非常有用。这将返回一个json列表[path1,path2...]
     * @param {string} dir_path 要读取的路径
     */
    list_dir(dir_path) {
        return fs.readdir(dir_path);
    },
}