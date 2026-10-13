import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'tests/browser',fullyParallel:false,workers:1,timeout:30000,
 use:{baseURL:'http://127.0.0.1:3000',launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],reporter:'list'});
