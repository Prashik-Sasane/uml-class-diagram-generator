import { useMemo, useRef, useState } from "react";
import "./styles.css";

const initialClasses = [
  {
    id: "class-1",
    name: "Customer",
    x: 80,
    y: 90,
    fields: "customerId: String\nname: String\nemail: String",
    methods: "placeOrder(order: Order): void\nupdateDetails(): void",
  },
  {
    id: "class-2",
    name: "Order",
    x: 440,
    y: 90,
    fields: "orderId: String\ntotalAmount: double\nstatus: String",
    methods: "calculateTotal(): double\nconfirmOrder(): void",
  },
  {
    id: "class-3",
    name: "Payment",
    x: 260,
    y: 370,
    fields: "paymentId: String\namount: double\nmethod: String",
    methods: "processPayment(): boolean\nrefund(): void",
  },
];

const initialRelationships = [
  {
    id: "rel-1",
    type: "association",
    sourceId: "class-1",
    targetId: "class-2",
  },
  {
    id: "rel-2",
    type: "composition",
    sourceId: "class-2",
    targetId: "class-3",
  },
];

function parseFields(raw) {
  if (!raw || !raw.trim()) return [];

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf(":");

      if (index === -1) {
        return {
          name: line,
          type: "String",
        };
      }

      return {
        name: line.slice(0, index).trim(),
        type: line.slice(index + 1).trim() || "String",
      };
    });
}

function parseMethods(raw) {
  if (!raw || !raw.trim()) return [];

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const openParen = line.indexOf("(");
      const closeParen = line.indexOf(")");

      if (openParen === -1 || closeParen === -1) {
        return {
          name: line,
          returnType: "void",
          params: [],
        };
      }

      const beforeParen = line.slice(0, openParen).trim();

      const returnType = beforeParen.includes(":")
        ? beforeParen.split(":").pop().trim()
        : "void";

      const name = beforeParen.includes(":")
        ? beforeParen.split(":")[0].trim()
        : beforeParen;

      const paramsText = line
        .slice(openParen + 1, closeParen)
        .trim();

      const params = paramsText
        ? paramsText
            .split(",")
            .map((param) => {
              const parts = param.trim().split(":");

              return {
                name: parts[0]?.trim() || "arg",
                type: parts[1]?.trim() || "String",
              };
            })
            .filter(Boolean)
        : [];

      return {
        name,
        returnType: returnType || "void",
        params,
      };
    });
}

function generateJavaCode(classes, relationships) {
  const inheritanceMap = new Map();
  const associationMap = new Map();

  relationships.forEach((rel) => {
    if (rel.type === "generalization") {
      inheritanceMap.set(rel.sourceId, rel.targetId);
      return;
    }

    const list = associationMap.get(rel.sourceId) || [];

    list.push({
      targetId: rel.targetId,
      type: rel.type,
    });

    associationMap.set(rel.sourceId, list);
  });

  return classes
    .map((cls) => {
      const fields = parseFields(cls.fields);
      const methods = parseMethods(cls.methods);

      const parentId = inheritanceMap.get(cls.id);

      const parentName = parentId
        ? classes.find((item) => item.id === parentId)?.name ||
          "ParentClass"
        : null;

      const fieldLines = fields.length
        ? fields
            .map(
              (field) =>
                `    private ${field.type} ${field.name};`
            )
            .join("\n")
        : "";

      const associationLines = (associationMap.get(cls.id) || [])
        .map((rel) => {
          const target = classes.find(
            (item) => item.id === rel.targetId
          );

          if (!target) return null;

          const variableName =
            target.name.charAt(0).toLowerCase() +
            target.name.slice(1);

          return `    private ${target.name} ${variableName};`;
        })
        .filter(Boolean)
        .join("\n");

      const methodLines = methods.length
        ? methods
            .map((method) => {
              const paramsText = method.params.length
                ? method.params
                    .map(
                      (param) =>
                        `${param.type} ${param.name}`
                    )
                    .join(", ")
                : "";

              const returnStatement =
                method.returnType === "void"
                  ? ""
                  : "return null;";

              return `    public ${method.returnType} ${method.name}(${paramsText}) {\n        ${returnStatement}\n    }`;
            })
            .join("\n\n")
        : "";

      const members = [
        fieldLines,
        associationLines,
        methodLines,
      ]
        .filter(Boolean)
        .join("\n\n");

      const classHeader = parentName
        ? `public class ${cls.name} extends ${parentName} {`
        : `public class ${cls.name} {`;

      return `${classHeader}\n${
        members ? `${members}\n` : ""
      }}`;
    })
    .join("\n\n");
}

function downloadJavaFile(content) {
  const blob = new Blob([content], {
    type: "text/java;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = "GeneratedClasses.java";

  document.body.appendChild(link);
  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}

function App() {
  const [classes, setClasses] = useState(initialClasses);
  const [relationships, setRelationships] = useState(
    initialRelationships
  );

  const [selectedClassId, setSelectedClassId] = useState(
    initialClasses[0].id
  );

  const [selectedRelationshipType, setSelectedRelationshipType] =
    useState("association");

  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");

  const [dragState, setDragState] = useState(null);

  const [activeTab, setActiveTab] = useState("diagram");

  const canvasRef = useRef(null);

  const generatedCode = useMemo(
    () => generateJavaCode(classes, relationships),
    [classes, relationships]
  );

  const selectedClass =
    classes.find((item) => item.id === selectedClassId) || null;

  const updateSelectedClass = (patch) => {
    setClasses((current) =>
      current.map((item) =>
        item.id === selectedClassId
          ? {
              ...item,
              ...patch,
            }
          : item
      )
    );
  };

  const addClass = () => {
    const id = `class-${Date.now()}`;

    const newClass = {
      id,
      name: `Class${classes.length + 1}`,
      x: 80 + (classes.length % 4) * 230,
      y: 100 + (classes.length % 3) * 170,
      fields: "attribute: String",
      methods: "method(): void",
    };

    setClasses((current) => [...current, newClass]);

    setSelectedClassId(id);
  };

  const deleteSelectedClass = () => {
    if (!selectedClassId) return;

    setClasses((current) =>
      current.filter(
        (item) => item.id !== selectedClassId
      )
    );

    setRelationships((current) =>
      current.filter(
        (rel) =>
          rel.sourceId !== selectedClassId &&
          rel.targetId !== selectedClassId
      )
    );

    const remaining = classes.filter(
      (item) => item.id !== selectedClassId
    );

    if (remaining.length) {
      setSelectedClassId(remaining[0].id);
    }
  };

  const addRelationship = () => {
    if (
      !sourceId ||
      !targetId ||
      sourceId === targetId
    ) {
      return;
    }

    const relation = {
      id: `rel-${Date.now()}`,
      type: selectedRelationshipType,
      sourceId,
      targetId,
    };

    setRelationships((current) => [
      ...current,
      relation,
    ]);

    setSourceId("");
    setTargetId("");
  };

  const removeRelationship = (id) => {
    setRelationships((current) =>
      current.filter((rel) => rel.id !== id)
    );
  };

  const handleMouseDown = (event, classId) => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    const source = classes.find(
      (cls) => cls.id === classId
    );

    if (!source) return;

    setDragState({
      id: classId,
      offsetX:
        event.clientX -
        rect.left -
        source.x,
      offsetY:
        event.clientY -
        rect.top -
        source.y,
    });
  };

  const handleMouseMove = (event) => {
    if (!dragState) return;

    const canvas = canvasRef.current;

    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    const nextX =
      event.clientX -
      rect.left -
      dragState.offsetX;

    const nextY =
      event.clientY -
      rect.top -
      dragState.offsetY;

    setClasses((current) =>
      current.map((cls) =>
        cls.id === dragState.id
          ? {
              ...cls,
              x: Math.max(20, nextX),
              y: Math.max(20, nextY),
            }
          : cls
      )
    );
  };

  const handleMouseUp = () => {
    setDragState(null);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(
        generatedCode
      );

      alert("Java source code copied.");
    } catch {
      alert(
        "Copy failed. Please copy the code manually."
      );
    }
  };

  return (
    <div className="app">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="brand">
          <div className="brand-icon">
            U
          </div>

          <div>
            <h2>UML Studio</h2>
            <span>Design workspace</span>
          </div>
        </div>

        <div className="sidebar-section">

          <p className="section-title">
            WORKSPACE
          </p>

          <button
            className={
              activeTab === "diagram"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              setActiveTab("diagram")
            }
          >
            <span>◈</span>
            Diagram
          </button>

          <button
            className={
              activeTab === "code"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              setActiveTab("code")
            }
          >
            <span>{"</>"}</span>
            Java Code
          </button>

        </div>

        <div className="sidebar-section">

          <div className="section-header">
            <p className="section-title">
              CLASSES
            </p>

            <button
              className="small-add"
              onClick={addClass}
            >
              +
            </button>
          </div>

          <div className="class-list">

            {classes.map((cls) => (
              <button
                key={cls.id}
                className={
                  selectedClassId === cls.id
                    ? "class-list-item selected"
                    : "class-list-item"
                }
                onClick={() =>
                  setSelectedClassId(cls.id)
                }
              >
                <span className="class-symbol">
                  C
                </span>

                <span>
                  {cls.name}
                </span>
              </button>
            ))}

          </div>
        </div>

        <div className="sidebar-bottom">

          <div className="project-card">
            <div className="project-dot"></div>

            <div>
              <strong>Current Project</strong>
              <span>
                {classes.length} classes ·{" "}
                {relationships.length} relations
              </span>
            </div>
          </div>

        </div>

      </aside>

      {/* MAIN */}

      <main className="main">

        {/* HEADER */}

        <header className="header">

          <div>
            <span className="breadcrumb">
              Projects / UML Designer
            </span>

            <h1>
              Class Diagram
            </h1>
          </div>

          <div className="header-actions">

            <button
              className="ghost-button"
              onClick={copyCode}
            >
              Copy Code
            </button>

            <button
              className="primary-button"
              onClick={() =>
                downloadJavaFile(
                  generatedCode
                )
              }
            >
              ↓ Export Java
            </button>

          </div>

        </header>

        {/* TOOLBAR */}

        <div className="toolbar">

          <div className="toolbar-left">

            <button
              className="tool-button"
              onClick={addClass}
            >
              <span>＋</span>
              Add Class
            </button>

            <div className="divider"></div>

            <span className="toolbar-label">
              {classes.length} Classes
            </span>

            <span className="toolbar-label">
              {relationships.length} Relationships
            </span>

          </div>

          <div className="zoom-controls">

            <button>−</button>
            <span>100%</span>
            <button>+</button>

          </div>

        </div>

        {/* CONTENT */}

        <div className="content">

          {/* DIAGRAM */}

          <section
            className={
              activeTab === "diagram"
                ? "diagram-section"
                : "diagram-section hidden"
            }
          >

            <div
              className="canvas"
              ref={canvasRef}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >

              <div className="canvas-grid"></div>

              <svg
                className="relationships"
                width="1400"
                height="900"
              >

                <defs>

                  <marker
                    id="arrow"
                    markerWidth="12"
                    markerHeight="12"
                    refX="10"
                    refY="6"
                    orient="auto"
                  >
                    <path
                      d="M0,0 L12,6 L0,12 Z"
                      fill="#8b5cf6"
                    />
                  </marker>

                </defs>

                {relationships.map(
                  (rel) => {

                    const source =
                      classes.find(
                        (cls) =>
                          cls.id ===
                          rel.sourceId
                      );

                    const target =
                      classes.find(
                        (cls) =>
                          cls.id ===
                          rel.targetId
                      );

                    if (
                      !source ||
                      !target
                    )
                      return null;

                    const x1 =
                      source.x + 190;

                    const y1 =
                      source.y + 85;

                    const x2 =
                      target.x;

                    const y2 =
                      target.y + 85;

                    const midX =
                      (x1 + x2) / 2;

                    const midY =
                      (y1 + y2) / 2;

                    return (
                      <g key={rel.id}>

                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="#8b5cf6"
                          strokeWidth="2"
                          strokeDasharray={
                            rel.type ===
                            "aggregation"
                              ? "8 6"
                              : "0"
                          }
                          markerEnd={
                            rel.type !==
                            "association"
                              ? "url(#arrow)"
                              : undefined
                          }
                        />

                        <rect
                          x={midX - 45}
                          y={midY - 28}
                          width="90"
                          height="24"
                          rx="12"
                          fill="#ffffff"
                          stroke="#e5e7eb"
                        />

                        <text
                          x={midX}
                          y={midY - 12}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#6b7280"
                        >
                          {rel.type}
                        </text>

                        <circle
                          cx={midX}
                          cy={midY + 12}
                          r="9"
                          fill="#fee2e2"
                          style={{
                            cursor: "pointer",
                          }}
                          onClick={() =>
                            removeRelationship(
                              rel.id
                            )
                          }
                        />

                        <text
                          x={midX}
                          y={midY + 16}
                          textAnchor="middle"
                          fontSize="12"
                          fill="#ef4444"
                          style={{
                            pointerEvents:
                              "none",
                          }}
                        >
                          ×
                        </text>

                      </g>
                    );
                  }
                )}

              </svg>

              {classes.map((cls) => {

                const fields =
                  parseFields(
                    cls.fields
                  );

                const methods =
                  parseMethods(
                    cls.methods
                  );

                return (
                  <div
                    key={cls.id}
                    className={
                      selectedClassId ===
                      cls.id
                        ? "uml-card selected"
                        : "uml-card"
                    }
                    style={{
                      left: cls.x,
                      top: cls.y,
                    }}
                    onMouseDown={(event) =>
                      handleMouseDown(
                        event,
                        cls.id
                      )
                    }
                    onClick={() =>
                      setSelectedClassId(
                        cls.id
                      )
                    }
                  >

                    <div className="uml-header">

                      <div className="uml-class-icon">
                        C
                      </div>

                      <div>
                        <strong>
                          {cls.name}
                        </strong>

                        <small>
                          class
                        </small>
                      </div>

                    </div>

                    <div className="uml-body">

                      <div className="uml-label">
                        ATTRIBUTES
                      </div>

                      {fields.map(
                        (field, index) => (
                          <div
                            className="uml-row"
                            key={index}
                          >
                            <span>
                              + {field.name}
                            </span>

                            <em>
                              {field.type}
                            </em>
                          </div>
                        )
                      )}

                    </div>

                    <div className="uml-body methods">

                      <div className="uml-label">
                        METHODS
                      </div>

                      {methods.map(
                        (method, index) => (
                          <div
                            className="uml-row"
                            key={index}
                          >
                            <span>
                              +{" "}
                              {method.name}()
                            </span>

                            <em>
                              {method.returnType}
                            </em>
                          </div>
                        )
                      )}

                    </div>

                  </div>
                );
              })}

              <div className="canvas-help">
                Drag classes to reposition
              </div>

            </div>

          </section>

          {/* CODE */}

          <section
            className={
              activeTab === "code"
                ? "code-section"
                : "code-section hidden"
            }
          >

            <div className="code-header">

              <div>
                <span>
                  GENERATED SOURCE
                </span>

                <h2>
                  Java Classes
                </h2>
              </div>

              <button
                className="primary-button"
                onClick={copyCode}
              >
                Copy
              </button>

            </div>

            <pre className="code-editor">
              {generatedCode}
            </pre>

          </section>

          {/* RIGHT PANEL */}

          <aside className="inspector">

            <div className="inspector-header">

              <div>
                <span>
                  INSPECTOR
                </span>

                <h2>
                  Class Properties
                </h2>
              </div>

            </div>

            {selectedClass && (
              <>

                <div className="form-section">

                  <label>
                    Class Name
                  </label>

                  <input
                    value={
                      selectedClass.name
                    }
                    onChange={(e) =>
                      updateSelectedClass(
                        {
                          name:
                            e.target.value,
                        }
                      )
                    }
                  />

                </div>

                <div className="form-section">

                  <label>
                    Attributes
                  </label>

                  <textarea
                    value={
                      selectedClass.fields
                    }
                    onChange={(e) =>
                      updateSelectedClass(
                        {
                          fields:
                            e.target.value,
                        }
                      )
                    }
                  />

                  <small>
                    One attribute per line:
                    name: Type
                  </small>

                </div>

                <div className="form-section">

                  <label>
                    Methods
                  </label>

                  <textarea
                    value={
                      selectedClass.methods
                    }
                    onChange={(e) =>
                      updateSelectedClass(
                        {
                          methods:
                            e.target.value,
                        }
                      )
                    }
                  />

                  <small>
                    Example:
                    method(): void
                  </small>

                </div>

                <button
                  className="delete-button"
                  onClick={
                    deleteSelectedClass
                  }
                >
                  Delete Class
                </button>

              </>
            )}

            <div className="inspector-divider"></div>

            <div className="relationship-section">

              <div className="relationship-title">

                <div>
                  <span>
                    RELATIONSHIPS
                  </span>

                  <h3>
                    Add Relationship
                  </h3>
                </div>

              </div>

              <label>
                Type
              </label>

              <select
                value={
                  selectedRelationshipType
                }
                onChange={(e) =>
                  setSelectedRelationshipType(
                    e.target.value
                  )
                }
              >
                <option value="association">
                  Association
                </option>

                <option value="generalization">
                  Inheritance
                </option>

                <option value="composition">
                  Composition
                </option>

                <option value="aggregation">
                  Aggregation
                </option>
              </select>

              <label>
                Source
              </label>

              <select
                value={sourceId}
                onChange={(e) =>
                  setSourceId(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select class
                </option>

                {classes.map((cls) => (
                  <option
                    key={cls.id}
                    value={cls.id}
                  >
                    {cls.name}
                  </option>
                ))}
              </select>

              <label>
                Target
              </label>

              <select
                value={targetId}
                onChange={(e) =>
                  setTargetId(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select class
                </option>

                {classes.map((cls) => (
                  <option
                    key={cls.id}
                    value={cls.id}
                  >
                    {cls.name}
                  </option>
                ))}
              </select>

              <button
                className="relationship-button"
                onClick={
                  addRelationship
                }
              >
                + Add Relationship
              </button>

            </div>

          </aside>

        </div>

      </main>

    </div>
  );
}

export default App;