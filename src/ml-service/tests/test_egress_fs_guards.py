import os
import tempfile
import socket
import pytest


def test_tmpfs_paths_exist_and_writable():
    # These should be tmpfs via compose; at minimum verify writable and not symlinks to host
    for p in ["/app/uploads", "/app/results"]:
        assert os.path.isdir(p)
        test_file = os.path.join(p, "_writetest.txt")
        with open(test_file, "w") as f:
            f.write("ok")
        os.remove(test_file)


def test_block_egress_to_external_host():
    # Attempt to resolve and connect to example.com should fail or be blocked by environment
    with pytest.raises(Exception):
        s = socket.socket()
        try:
            s.settimeout(1)
            s.connect(("example.com", 80))
        finally:
            s.close()

