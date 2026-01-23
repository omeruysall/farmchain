from flask import Flask, render_template, request, jsonify
import random
import time

from puzzle import private_to_hash160, address_to_hash160

app = Flask(__name__)

TARGET_ADDRESS = "1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU"
TARGET_HASH160 = address_to_hash160(TARGET_ADDRESS)

@app.route("/")
def index():
    return render_template("index.html", target=TARGET_ADDRESS)

@app.route("/scan", methods=["POST"])
def scan():
    start_hex = request.form["start"]
    end_hex = request.form["end"]
    tries = int(request.form["tries"])

    start_int = int(start_hex, 16)
    end_int = int(end_hex, 16)
    size = end_int - start_int + 1

    t0 = time.time()

    for i in range(tries):
        key = start_int + random.randrange(size)
        if private_to_hash160(key) == TARGET_HASH160:
            return jsonify({
                "found": True,
                "private_hex": hex(key),
                "private_dec": key
            })

    elapsed = time.time() - t0
    return jsonify({
        "found": False,
        "tries": tries,
        "speed": int(tries / elapsed) if elapsed > 0 else 0
    })

if __name__ == "__main__":
    app.run(debug=True)
