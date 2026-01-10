/**
 * ============================================
 * LibreTV 本地数据库重置脚本
 * ============================================
 * 
 * 【用途】
 * 完全清空本地开发数据库并重新初始化
 * 
 * 【使用方法】
 * npm run reset:local-db
 * 
 * 【警告】
 * ⚠️ 此操作会删除所有本地开发数据！
 * ⚠️ 不影响 Cloudflare 远程生产数据库
 * 
 * 【执行步骤】
 * 1. 删除 .wrangler 文件夹（包含本地数据库）
 * 2. 重新运行初始化脚本
 * 
 * ============================================
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI 颜色代码
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
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
        logSection('🔄 LibreTV 本地数据库重置');

        log('⚠️  警告：此操作将删除所有本地开发数据！', 'yellow');
        log('   （不影响 Cloudflare 远程生产数据）\n', 'yellow');

        // 1. 删除 .wrangler 文件夹
        const wranglerPath = path.join(__dirname, '..', '.wrangler');

        if (fs.existsSync(wranglerPath)) {
            log('🗑️  正在删除 .wrangler 文件夹...', 'cyan');

            try {
                // Windows 和 Unix 兼容的删除命令
                if (process.platform === 'win32') {
                    execSync(`rmdir /s /q "${wranglerPath}"`, { stdio: 'inherit' });
                } else {
                    execSync(`rm -rf "${wranglerPath}"`, { stdio: 'inherit' });
                }

                log('✅ 已删除旧数据', 'green');
            } catch (error) {
                log('⚠️  删除失败，可能文件夹不存在或被占用', 'yellow');
            }
        } else {
            log('ℹ️  .wrangler 文件夹不存在，跳过删除', 'cyan');
        }

        // 2. 重新初始化
        log('\n📊 开始重新初始化数据库...', 'cyan');

        const initScriptPath = path.join(__dirname, 'init-local-db.js');

        if (!fs.existsSync(initScriptPath)) {
            log('❌ 找不到初始化脚本：init-local-db.js', 'red');
            process.exit(1);
        }

        execSync(`node "${initScriptPath}"`, { stdio: 'inherit' });

        logSection('✅ 重置完成！');

        log('🎯 本地数据库已完全重置并重新初始化', 'green');
        log('   现在可以开始全新的开发了！\n', 'cyan');

    } catch (error) {
        log('\n❌ 重置失败！', 'red');
        log(`   错误信息：${error.message}`, 'yellow');
        process.exit(1);
    }
}

main();
