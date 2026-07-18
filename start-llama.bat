@echo off
chcp 65001 >nul
echo ==========================================
echo  GPT-OSS-20B IQ4_XS 本地极速版
echo  RTX 5060 Ti 16GB · 100+ tok/s
echo  OpenAI 开源 · 默认推荐
echo ==========================================
echo.

taskkill /F /IM llama-server.exe 2>nul
sleep 2

"D:llama-b8581-bin-win-cuda-12.4-x64llama-server.exe" ^
  -m "D:modelsgpt-oss-20bgpt-oss-20b.IQ4_XS.gguf" ^
  --port 8082 ^
  --host 0.0.0.0 ^
  -ngl 99 ^
  -c 8192 ^
  -t 20 ^
  -b 2048 ^
  -ub 512 ^
  --flash-attn on ^
  --mlock ^
  --cache-type-k q8_0 ^
  --cache-type-v q8_0 ^
  --no-mmap ^
  --cont-batching ^
  --temp 0.7 ^
  --top-p 0.9

echo.
echo 服务器已启动 http://localhost:8082
echo APP 设置:IP=127.0.0.1 端口=8082 模型名=gpt-oss-20b.IQ4_XS.gguf
echo.
pause