"""Build a tiny llama-architecture GGUF *test fixture* with random weights.

This is NOT a useful language model. It exists only to verify, offline, that the local
inference runtime (llama.cpp via node-llama-cpp) can load a GGUF file, tokenize, generate,
respect token limits, time out and be cancelled. Real answers need real open weights
(see docs/LOCAL_MODELS.md).

Usage: python3 scripts/make_test_gguf.py models/test-fixture.gguf   (requires: pip install gguf numpy)
"""
import sys
import numpy as np
import gguf

out = sys.argv[1] if len(sys.argv) > 1 else "models/test-fixture.gguf"
rng = np.random.default_rng(1234)

n_embd, n_layer, n_head, n_ff, n_ctx = 64, 2, 4, 128, 512

tokens, scores, types = [], [], []
def add(tok, score, typ):
    tokens.append(tok.encode("utf-8")); scores.append(score); types.append(typ)

add("<unk>", 0.0, gguf.TokenType.UNKNOWN)
add("<s>", 0.0, gguf.TokenType.CONTROL)
add("</s>", 0.0, gguf.TokenType.CONTROL)
for b in range(256):
    add(f"<0x{b:02X}>", 0.0, gguf.TokenType.BYTE)
add("▁", -1.0, gguf.TokenType.NORMAL)
for i, ch in enumerate("abcdefghijklmnopqrstuvwxyz0123456789=+-"):
    add(ch, -2.0 - i * 0.01, gguf.TokenType.NORMAL)
    add("▁" + ch, -2.5 - i * 0.01, gguf.TokenType.NORMAL)
n_vocab = len(tokens)

w = gguf.GGUFWriter(out, "llama")
w.add_name("exammate-runtime-test-fixture")
w.add_context_length(n_ctx)
w.add_embedding_length(n_embd)
w.add_block_count(n_layer)
w.add_feed_forward_length(n_ff)
w.add_head_count(n_head)
w.add_head_count_kv(n_head)
w.add_rope_dimension_count(n_embd // n_head)
w.add_layer_norm_rms_eps(1e-5)
w.add_file_type(gguf.LlamaFileType.ALL_F32)
w.add_tokenizer_model("llama")
w.add_token_list(tokens)
w.add_token_scores(scores)
w.add_token_types(types)
w.add_unk_token_id(0)
w.add_bos_token_id(1)
w.add_eos_token_id(2)
w.add_add_bos_token(True)

def t(*shape):
    return (rng.standard_normal(shape) * 0.05).astype(np.float32)

w.add_tensor("token_embd.weight", t(n_vocab, n_embd))
for l in range(n_layer):
    w.add_tensor(f"blk.{l}.attn_norm.weight", np.ones(n_embd, dtype=np.float32))
    w.add_tensor(f"blk.{l}.attn_q.weight", t(n_embd, n_embd))
    w.add_tensor(f"blk.{l}.attn_k.weight", t(n_embd, n_embd))
    w.add_tensor(f"blk.{l}.attn_v.weight", t(n_embd, n_embd))
    w.add_tensor(f"blk.{l}.attn_output.weight", t(n_embd, n_embd))
    w.add_tensor(f"blk.{l}.ffn_norm.weight", np.ones(n_embd, dtype=np.float32))
    w.add_tensor(f"blk.{l}.ffn_gate.weight", t(n_ff, n_embd))
    w.add_tensor(f"blk.{l}.ffn_up.weight", t(n_ff, n_embd))
    w.add_tensor(f"blk.{l}.ffn_down.weight", t(n_embd, n_ff))
w.add_tensor("output_norm.weight", np.ones(n_embd, dtype=np.float32))
w.add_tensor("output.weight", t(n_vocab, n_embd))

w.write_header_to_file()
w.write_kv_data_to_file()
w.write_tensors_to_file()
w.close()
print(f"wrote {out} (vocab={n_vocab}, layers={n_layer}, embd={n_embd})")
