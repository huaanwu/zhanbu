import sys
import http.client
import socket
from http.server import HTTPServer, BaseHTTPRequestHandler

TARGET_HOST = "127.0.0.1"
TARGET_PORT = 8082
PROXY_PORT = 8083

# Auto-detect llama.cpp port
for port in [8082, 8083, 11434]:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1)
        s.connect((TARGET_HOST, port))
        s.close()
        TARGET_PORT = port
        print(f"Found llama.cpp on port {port}")
        break
    except:
        continue

class CORSProxyHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Max-Age", "86400")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        self._proxy_request("GET")

    def do_POST(self):
        self._proxy_request("POST")

    def _proxy_request(self, method):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else b''
            
            conn = http.client.HTTPConnection(TARGET_HOST, TARGET_PORT, timeout=300)
            headers = {k: v for k, v in self.headers.items() if k.lower() not in ['host', 'origin']}
            
            conn.request(method, self.path, body=body, headers=headers)
            response = conn.getresponse()
            
            self.send_response(response.status)
            self._set_cors_headers()
            
            for header, value in response.getheaders():
                if header.lower() not in ['transfer-encoding', 'content-encoding']:
                    self.send_header(header, value)
            self.end_headers()
            
            self.wfile.write(response.read())
            conn.close()
        except Exception as e:
            self.send_response(502)
            self._set_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(f'{"error": "Proxy error: {str(e)}"}'.encode())

    def log_message(self, format, *args):
        print(f"[CORS Proxy] {self.client_address[0]} - {format % args}")

try:
    server = HTTPServer(("127.0.0.1", PROXY_PORT), CORSProxyHandler)
    print(f"CORS Proxy running on http://127.0.0.1:{PROXY_PORT}")
    print(f"Forwarding to http://{TARGET_HOST}:{TARGET_PORT}")
    print("Press Ctrl+C to stop")
    server.serve_forever()
except KeyboardInterrupt:
    print("\nShutting down...")
    server.shutdown()
