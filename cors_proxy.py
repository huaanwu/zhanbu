#!/usr/bin/env python3
# CORS Proxy for llama.cpp
# Usage: python3 cors_proxy.py
# Then in APP, set port to 8083 (or whatever port this proxy runs on)

import http.server
import socketserver
import urllib.request
import json

PORT = 8083
TARGET = "http://127.0.0.1:8082"

class CORSHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        try:
            req = urllib.request.Request(TARGET + self.path)
            with urllib.request.urlopen(req) as resp:
                self.send_response(resp.status)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', resp.headers.get('Content-Type', 'application/json'))
                self.end_headers()
                self.wfile.write(resp.read())
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            req = urllib.request.Request(TARGET + self.path, data=body, headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req) as resp:
                self.send_response(resp.status)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', resp.headers.get('Content-Type', 'application/json'))
                self.end_headers()
                self.wfile.write(resp.read())
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def log_message(self, format, *args):
        print(f"[CORS Proxy] {format % args}")

if __name__ == '__main__':
    with socketserver.TCPServer(("", PORT), CORSHandler) as httpd:
        print(f"CORS Proxy running on port {PORT} -> {TARGET}")
        print(f"In APP settings, use IP: 192.168.1.7, Port: {PORT}")
        httpd.serve_forever()
