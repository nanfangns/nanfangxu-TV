/**
 * ============================================
 * LibreTV 本地 D1 数据库初始化脚本
 * ============================================
 * 
 * 【用途】
 * 在本地开发环境中初始化 Wrangler D1 数据库，包括：
 * - 创建所有必需的表结构（users, user_data）
 * - 创建索引以提升查询性能
 * - 插入默认管理员账号
 * 
 * 【使用方法】
 * npm run init:local-db
 * 
 * 【重要说明】
 * 1. 本地数据持久化：数据保存在 .wrangler/state/v3/d1/ 中
 * 2. 数据不会丢失：只要不删除 .wrangler 文件夹，重启后数据依然存在
 * 3. 默认管理员：用户名 nanfang，密码 admin123
 * 4. 重置数据：运行 npm run reset:local-db 可清空并重新初始化
 * 
 * 【工作流程】
 * 1. 首次开发：npm run init:local-db
 * 2. 日常开发：npm run dev:cf（数据持久化，无需重新初始化）
 * 3. 需要重置：npm run reset:local-db
 * 
 * ============================================
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI 颜色代码（用于美化输出）
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    red: '\x1b[31m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(50));
    log(title, 'bright');
    console.log('='.repeat(50) + '\n');
}

async function main() {
    try {
        logSection('🚀 LibreTV 本地数据库初始化');

        // 1. 检查 init.sql 是否存在
        const sqlPath = path.join(__dirname, 'init.sql');
        if (!fs.existsSync(sqlPath)) {
            log('❌ 错误：找不到 init.sql 文件', 'red');
            log(`   期望路径：${sqlPath}`, 'yellow');
            process.exit(1);
        }

        log('📄 找到初始化 SQL 文件', 'green');
        log(`   路径：${sqlPath}`, 'cyan');

        // 2. 检查数据库名称（从 wrangler.toml 读取）
        const wranglerPath = path.join(__dirname, '..', 'wrangler.toml');
        let dbName = 'my-tv-db'; // 默认值

        if (fs.existsSync(wranglerPath)) {
            const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
            const match = wranglerContent.match(/database_name\s*=\s*"([^"]+)"/);
            if (match) {
                dbName = match[1];
                log(`✅ 从 wrangler.toml 读取数据库名称：${dbName}`, 'green');
            }
        }

        // 3. 执行初始化
        log('\n📊 开始执行数据库初始化...', 'blue');

        const command = `npx wrangler d1 execute ${dbName} --local --file="${sqlPath}"`;
        log(`   命令：${command}`, 'cyan');

        log('\n⏳ 执行中...', 'yellow');

        const output = execSync(command, {
            encoding: 'utf8',
            stdio: 'pipe'
        });

        log('\n' + output, 'cyan');

        // 4. 验证初始化结果
        log('\n🔍 验证数据库初始化结果...', 'blue');

        const verifyCommand = `npx wrangler d1 execute ${dbName} --local --command="SELECT username, role FROM users WHERE role='admin'"`;
        const verifyOutput = execSync(verifyCommand, {
            encoding: 'utf8',
            stdio: 'pipe'
        });

        log(verifyOutput, 'cyan');

        // 5. 成功提示
        logSection('✅ 初始化完成！');

        log('📦 本地数据库已准备就绪', 'green');
        log(`   数据保存位置：.wrangler/state/v3/d1/`, 'cyan');
        log('   💡 提示：数据会持久化保存，重启后依然存在\n', 'cyan');

        log('👤 默认管理员账号', 'green');
        log('   用户名：nanfang', 'cyan');
        log('   密码：admin123', 'cyan');
        log('   ⚠️  建议：首次登录后请修改密码\n', 'yellow');

        log('🎯 下一步操作', 'green');
        log('   1. 启动开发服务器：npm run dev:cf', 'cyan');
        log('   2. 访问：http://localhost:8788', 'cyan');
        log('   3. 使用管理员账号登录', 'cyan');
        log('   4. 进入管理后台测试功能\n', 'cyan');

        log('📝 其他命令', 'green');
        log('   - 重置数据库：npm run reset:local-db', 'cyan');
        log('   - 查看数据库：npx wrangler d1 execute ' + dbName + ' --local --command="SELECT * FROM users"', 'cyan');
        log('   - 连接远程数据库：npm run dev:remote\n', 'cyan');

        console.log('='.repeat(50) + '\n');

    } catch (error) {
        log('\n❌ 初始化失败！', 'red');
        log(`   错误信息：${error.message}`, 'yellow');

        if (error.stderr) {
            log(`\n错误详情：`, 'red');
            log(error.stderr.toString(), 'yellow');
        }

        log('\n💡 可能的解决方案：', 'cyan');
        log('   1. 确保已安装 wrangler：npm install -g wrangler', 'cyan');
        log('   2. 确保 wrangler.toml 配置正确', 'cyan');
        log('   3. 尝试手动执行：npx wrangler d1 execute my-tv-db --local --command="SELECT 1"', 'cyan');

        process.exit(1);
    }
}

// 执行主函数
main();
