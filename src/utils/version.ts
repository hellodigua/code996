import * as fs from 'fs'
import * as path from 'path'

/**
 * 读取 package.json 中的版本号
 */
export function getPackageVersion(): string {
  try {
    // 从当前文件向上两级找到package.json
    const packageJsonPath = path.join(__dirname, '../../package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    return packageJson.version
  } catch (error) {
    // 如果读取失败，尝试从进程目录读取
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json')
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      return packageJson.version
    } catch (error2) {
      // 如果读取失败，返回默认版本号
      return '0.0.0'
    }
  }
}
