"use client";

import { Suspense, useState, useRef, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Icon } from "@/lib/icons";

type CalculatorMode = "TIDAK" | "DASAR" | "SCIENTIFIC";
type AngleMode = "DEG" | "RAD";

interface ScientificCalculatorProps {
  mode: CalculatorMode;
  attemptId: number;
  onOpen?: () => void;
  onUse?: () => void;
}

interface CalculatorState {
  expression: string;
  result: string | null;
  angleMode: AngleMode;
  isOpen: boolean;
  position: { x: number; y: number };
  isDragging: boolean;
  dragOffset: { x: number; y: number };
}

const MAX_EXPRESSION_LENGTH = 100;

export function ScientificCalculator({ mode, attemptId, onOpen, onUse }: ScientificCalculatorProps) {
  if (mode === "TIDAK") return null;

  const [state, setState] = useState<CalculatorState>({
    expression: "",
    result: null,
    angleMode: "DEG",
    isOpen: false,
    position: { x: 0, y: 0 },
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
  });

  const [isDesktop, setIsDesktop] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const hasLoggedOpen = useRef(false);
  const hasLoggedUse = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
      // Center the calculator
      const centerX = (window.innerWidth - 320) / 2;
      const centerY = (window.innerHeight - 400) / 2;
      setState((prev) => ({ ...prev, position: { x: centerX, y: centerY } }));
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleOpen = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: true }));
    if (!hasLoggedOpen.current && onOpen) {
      hasLoggedOpen.current = true;
      onOpen();
    }
  }, [onOpen]);

  const handleClose = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false, expression: "", result: null }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isDesktop && panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setState((prev) => ({
        ...prev,
        isDragging: true,
        dragOffset: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      }));
    }
  }, [isDesktop]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (state.isDragging) {
      setState((prev) => ({
        ...prev,
        position: {
          x: e.clientX - state.dragOffset.x,
          y: e.clientY - state.dragOffset.y,
        },
      }));
    }
  }, [state.isDragging, state.dragOffset]);

  const handleMouseUp = useCallback(() => {
    setState((prev) => ({ ...prev, isDragging: false }));
  }, []);

  useEffect(() => {
    if (state.isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [state.isDragging, handleMouseMove, handleMouseUp]);

  const appendToExpression = useCallback((value: string) => {
    setState((prev) => {
      if (prev.expression.length >= MAX_EXPRESSION_LENGTH) return prev;
      return { ...prev, expression: prev.expression + value, result: null };
    });
  }, []);

  const clearAll = useCallback(() => {
    setState((prev) => ({ ...prev, expression: "", result: null }));
  }, []);

  const deleteLast = useCallback(() => {
    setState((prev) => ({
      ...prev,
      expression: prev.expression.slice(0, -1),
      result: null,
    }));
  }, []);

  const toggleAngleMode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      angleMode: prev.angleMode === "DEG" ? "RAD" : "DEG",
      result: null,
    }));
  }, []);

  const calculate = useCallback(async () => {
    if (!state.expression.trim()) return;

    try {
      const math = await import("mathjs");
      const expr = state.expression;

      // Validate expression characters
      const allowedChars = /^[0-9+\-*/().%^!√²πe\s,a-z]+$/i;
      if (!allowedChars.test(expr)) {
        setState((prev) => ({ ...prev, result: "Error" }));
        return;
      }

      // Check for balanced parentheses
      let openCount = 0;
      for (const char of expr) {
        if (char === "(") openCount++;
        if (char === ")") openCount--;
        if (openCount < 0) {
          setState((prev) => ({ ...prev, result: "Error" }));
          return;
        }
      }
      if (openCount !== 0) {
        setState((prev) => ({ ...prev, result: "Error" }));
        return;
      }

      // Replace display symbols with mathjs equivalents
      let mathExpr = expr
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/√/g, "sqrt")
        .replace(/²/g, "^2")
        .replace(/π/g, "pi")
        .replace(/%/g, "/100");

      // Handle angle mode for trig functions
      if (state.angleMode === "DEG") {
        // Convert degrees to radians for trig functions
        mathExpr = mathExpr.replace(/sin\(/g, "sin((pi/180)*");
        mathExpr = mathExpr.replace(/cos\(/g, "cos((pi/180)*");
        mathExpr = mathExpr.replace(/tan\(/g, "tan((pi/180)*");
        // For inverse trig, convert result from radians to degrees
        mathExpr = mathExpr.replace(/asin\(/g, "(180/pi)*asin(");
        mathExpr = mathExpr.replace(/acos\(/g, "(180/pi)*acos(");
        mathExpr = mathExpr.replace(/atan\(/g, "(180/pi)*atan(");
      }

      // Create mathjs instance
      const limitedMath = math.create(math.all, {
        number: "BigNumber",
        precision: 10,
      });

      // Try to evaluate
      let result;
      try {
        result = limitedMath.evaluate(mathExpr);
      } catch (e) {
        setState((prev) => ({ ...prev, result: "Error" }));
        return;
      }

      // Check for invalid results
      if (typeof result === "number" && (isNaN(result) || !isFinite(result))) {
        setState((prev) => ({ ...prev, result: "Error" }));
        return;
      }

      // Format result to 10 significant digits
      const formatted = limitedMath.format(result, { precision: 10 });
      setState((prev) => ({ ...prev, result: formatted }));

      if (!hasLoggedUse.current && onUse) {
        hasLoggedUse.current = true;
        onUse();
      }
    } catch (error) {
      setState((prev) => ({ ...prev, result: "Error" }));
    }
  }, [state.expression, state.angleMode, onUse]);

  const isScientific = mode === "SCIENTIFIC";

  const basicButtons = [
    { label: "7", value: "7" },
    { label: "8", value: "8" },
    { label: "9", value: "9" },
    { label: "÷", value: "/" },
    { label: "AC", action: clearAll, className: "bg-red-100 text-red-700" },
    { label: "4", value: "4" },
    { label: "5", value: "5" },
    { label: "6", value: "6" },
    { label: "×", value: "*" },
    { label: "⌫", action: deleteLast, className: "bg-gray-200" },
    { label: "1", value: "1" },
    { label: "2", value: "2" },
    { label: "3", value: "3" },
    { label: "-", value: "-" },
    { label: "(", value: "(" },
    { label: "0", value: "0" },
    { label: ".", value: "." },
    { label: "%", value: "%" },
    { label: "+", value: "+" },
    { label: ")", value: ")" },
  ];

  const scientificButtons = [
    { label: "sin", value: "sin(" },
    { label: "cos", value: "cos(" },
    { label: "tan", value: "tan(" },
    { label: "log", value: "log(" },
    { label: "ln", value: "ln(" },
    { label: "√", value: "√(" },
    { label: "x²", value: "^2" },
    { label: "xʸ", value: "^" },
    { label: "(", value: "(" },
    { label: ")", value: ")" },
    { label: "π", value: "π" },
    { label: "e", value: "e" },
    { label: "n!", value: "!" },
    { label: "1/x", value: "^(-1)" },
    { label: "abs", value: "abs(" },
  ];

  const trigInverseButtons = [
    { label: "asin", value: "asin(" },
    { label: "acos", value: "acos(" },
    { label: "atan", value: "atan(" },
  ];

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="fixed bottom-[48%] right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg hover:brightness-110 lg:right-8"
        aria-label="Buka kalkulator">
        <FontAwesomeIcon icon={Icon.Calculator} className="w-6 h-6" />
      </button>

      {state.isOpen && (
        <div
          ref={panelRef}
          onMouseDown={handleMouseDown}
          className={`fixed z-20 select-none bg-white shadow-2xl ${
            isDesktop
              ? "rounded-lg border border-gray-200"
              : "bottom-0 left-0 right-0 rounded-t-xl border-t border-gray-200"
          }`}
          style={
            isDesktop
              ? { left: state.position.x, top: state.position.y, width: "320px" }
              : undefined
          }>
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
            <span className="text-sm font-semibold text-gray-700">Kalkulator</span>
            <div className="flex items-center gap-2">
              {isScientific && (
                <button
                  type="button"
                  onClick={toggleAngleMode}
                  className="rounded px-2 py-1 text-xs font-semibold bg-brand-soft text-brand">
                  {state.angleMode}
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="rounded p-1 text-gray-500 hover:bg-gray-200">
                <FontAwesomeIcon icon={Icon.Xmark} className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-3">
            <div className="mb-3 rounded bg-gray-100 p-3">
              <div className="min-h-[24px] text-right text-sm text-gray-600 font-mono break-all">
                {state.expression || "0"}
              </div>
              <div className="min-h-[32px] text-right text-2xl font-semibold text-gray-900 font-mono">
                {state.result ?? ""}
              </div>
            </div>

            <div className="grid gap-2">
                {isScientific && (
                  <div className="grid grid-cols-5 gap-1">
                    {scientificButtons.map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => "action" in btn ? (btn.action as () => void)() : appendToExpression(btn.value)}
                        className="min-h-[36px] rounded bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                        {btn.label}
                      </button>
                    ))}
                  </div>
                )}

                {isScientific && (
                  <div className="grid grid-cols-3 gap-1">
                    {trigInverseButtons.map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => appendToExpression(btn.value)}
                        className="min-h-[36px] rounded bg-indigo-50 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                        {btn.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-5 gap-1">
                  {basicButtons.map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => "action" in btn ? (btn.action as () => void)() : appendToExpression(btn.value)}
                      className={`min-h-[44px] rounded text-base font-semibold ${
                        btn.className || "bg-gray-100 text-gray-900 hover:bg-gray-200"
                      }`}>
                      {btn.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={calculate}
                  className="min-h-[44px] w-full rounded bg-brand py-3 font-semibold text-white hover:brightness-110">
                  =
                </button>
              </div>
          </div>
        </div>
      )}
    </>
  );
}
