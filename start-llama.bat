@echo off
chcp 65001 >nul
echo ==========================================
echo  启动 llama.cpp 本地大模型服务器
echo ==========================================
echo.

REM 先终止旧的 llama-server 进程
taskkill /F /IM llama-server.exe 2>nul

echo 正在启动 llama.cpp...
echo 模型: Huihui-Qwen3.5-9B-abliterated.Q4_K_M.gguf
echo 端口: 8082
echo.

REM 启动 llama.cpp 服务器
"D:llama-b8581-bin-win-cuda-12.4-x64llama-server.exe" ^
  -m "D:modelsqwen35-9b-abliteratedHuihui-Qwen3.5-9B-abliterated.Q4_K_M.gguf" ^
  --mmproj "D:modelsqwen35-9b-abliteratedHuihui-Qwen3.5-9B-abliterated.mmproj-Q8_0.gguf" ^
  --port 8082 ^
  --host 0.0.0.0 ^
  -ngl 99 ^
  --ctx-size 8192

echo.
echo 服务器已启动！
echo 请在 APP 设置中填写：
echo   IP: 127.0.0.1
echo   端口: 8082
echo   模型名: Huihui-Qwen3.5-9B-abliterated.Q4_K_M.gguf
echo.
pause
