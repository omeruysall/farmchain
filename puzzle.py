import ecdsa
import hashlib
import base58

curve = ecdsa.SECP256k1

def private_to_hash160(priv_int: int) -> bytes:
    priv_bytes = priv_int.to_bytes(32, 'big')
    sk = ecdsa.SigningKey.from_string(priv_bytes, curve=curve)
    vk = sk.verifying_key

    pub = vk.to_string()
    x = pub[:32]
    y = pub[32:]

    prefix = b'\x02' if int.from_bytes(y, 'big') % 2 == 0 else b'\x03'
    pub_comp = prefix + x

    sha = hashlib.sha256(pub_comp).digest()
    rip = hashlib.new('ripemd160', sha).digest()
    return rip


def address_to_hash160(addr: str) -> bytes:
    return base58.b58decode_check(addr)[1:]
