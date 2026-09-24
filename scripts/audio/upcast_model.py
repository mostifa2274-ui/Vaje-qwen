"""Run the fp16 Kokoro export at float32 precision.

The published fp16 ONNX model computes in half precision, and for some
inputs an intermediate value overflows and the whole waveform becomes NaN
(silence after encoding). This rewrites the graph so every fp16 weight is
stored as float32 and every cast targets float32. The weights keep their
fp16 values; only the arithmetic gets the headroom it needs.

usage: python upcast_model.py model_fp16.onnx model_fp32.onnx
"""

from __future__ import annotations

import sys

import numpy as np
import onnx
from onnx import TensorProto, numpy_helper

FP16 = TensorProto.FLOAT16
FP32 = TensorProto.FLOAT


def upcast_tensor(tensor: onnx.TensorProto) -> onnx.TensorProto:
    if tensor.data_type != FP16:
        return tensor
    array = numpy_helper.to_array(tensor).astype(np.float32)
    return numpy_helper.from_array(array, tensor.name)


def main(source: str, target: str) -> int:
    model = onnx.load(source)
    graph = model.graph
    initializers = [upcast_tensor(tensor) for tensor in graph.initializer]
    del graph.initializer[:]
    graph.initializer.extend(initializers)

    for node in graph.node:
        for attribute in node.attribute:
            if attribute.type == onnx.AttributeProto.TENSOR and attribute.t.data_type == FP16:
                attribute.t.CopyFrom(upcast_tensor(attribute.t))
            elif attribute.name in ("to", "dtype") and attribute.type == onnx.AttributeProto.INT and attribute.i == FP16:
                attribute.i = FP32

    for info in [*graph.value_info, *graph.input, *graph.output]:
        if info.type.tensor_type.elem_type == FP16:
            info.type.tensor_type.elem_type = FP32

    onnx.checker.check_model(model)
    onnx.save(model, target)
    return 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:3]))
