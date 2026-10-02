import { useMemo, useRef, useState } from 'react';

const initialClasses = [
  {
    id: 'class-1',
    name: 'Customer',
    x: 90,
    y: 80,
    fields: 'customerId: String\nname: String\nemail: String',
    methods: 'placeOrder(order: Order): void\nupdateDetails(): void'
  },
  {
    id: 'class-2',
    name: 'Order',
    x: 430,
    y: 80,
    fields: 'orderId: String\ntotalAmount: double\nstatus: String',
    methods: 'calculateTotal(): double\nconfirmOrder(): void'
  },
  {
    id: 'class-3',
    name: 'Payment',
    x: 260,
    y: 360,
    fields: 'paymentId: String\namount: double\nmethod: String',
    methods: 'processPayment(): boolean\nrefund(): void'
  }
];

const initialRelationships = [
  { id: 'rel-1', type: 'association', sourceId: 'class-1', targetId: 'class-2' },
  { id: 'rel-2', type: 'composition', sourceId: 'class-2', targetId: 'class-3' }
];

function parseFields(raw) {
  if (!raw || !raw.trim()) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf(':');
      if (index === -1) return { name: line, type: 'String' };
      return {
        name: line.slice(0, index).trim(),
        type: line.slice(index + 1).trim() || 'String'
      };
    });
}

function parseMethods(raw) {
  if (!raw || !raw.trim()) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const openParen = line.indexOf('(');
      const closeParen = line.indexOf(')');
      if (openParen === -1 || closeParen === -1) return { name: line, returnType: 'void', params: [] };

      const beforeParen = line.slice(0, openParen).trim();
      const returnType = beforeParen.includes(':') ? beforeParen.split(':').pop().trim() : 'void';
      const name = beforeParen.includes(':') ? beforeParen.split(':')[0].trim() : beforeParen;
      const paramsText = line.slice(openParen + 1, closeParen).trim();
      const params = paramsText
        ? paramsText.split(',').map((p) => {
            const trimmed = p.trim();
            if (!trimmed) return null;
            const parts = trimmed.split(':').map((v) => v.trim());
            return { name: parts[0] || 'arg', type: parts[1] || 'String' };
          }).filter(Boolean)
        : [];
      return { name, returnType: returnType || 'void', params };
    });
}

function generateJavaCode(classes, relationships) {
  const inheritanceMap = new Map();
  const associationMap = new Map();

  relationships.forEach((rel) => {
    if (rel.type === 'generalization') {
      inheritanceMap.set(rel.sourceId, rel.targetId);
      return;
    }

    const list = associationMap.get(rel.sourceId) || [];
    list.push({ targetId: rel.targetId, type: rel.type });
    associationMap.set(rel.sourceId, list);
  });

  return classes.map((cls) => {
    const fields = parseFields(cls.fields);
    const methods = parseMethods(cls.methods);
    const parentId = inheritanceMap.get(cls.id);
    const parentName = parentId ? classes.find((item) => item.id === parentId)?.name || 'ParentClass' : null;

    const fieldLines = fields.length
      ? fields.map((field) => `    private ${field.type} ${field.name};`).join('\n')
      : '';

    const associationLines = (associationMap.get(cls.id) || [])
      .map((rel) => {
        const target = classes.find((item) => item.id === rel.targetId);
        if (!target) return null;
        const lowerTargetName = target.name.charAt(0).toLowerCase() + target.name.slice(1);
        return `    private ${target.name} ${lowerTargetName};`;
      })
      .filter(Boolean)
      .join('\n');

    const methodLines = methods.length
      ? methods.map((method) => {
          const paramsText = method.params.length
            ? method.params.map((param) => `${param.type} ${param.name}`).join(', ')
            : '';
          const call = method.returnType === 'void' ? '' : 'return null;';
          return `    public ${method.returnType} ${method.name}(${paramsText}) {\n        ${call}\n    }`;
        }).join('\n\n')
      : '';

    const members = [fieldLines, associationLines, methodLines].filter(Boolean).join('\n\n');
    const classHeader = parentName ? `public class ${cls.name} extends ${parentName} {` : `public class ${cls.name} {`;

    return `${classHeader}\n${members ? `${members}\n` : ''}}`;
  }).join('\n\n');
}

function downloadJavaFile(content) {
  const blob = new Blob([content], { type: 'text/java;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'GeneratedClasses.java';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function App() {
  const [classes, setClasses] = useState(initialClasses);
  const [relationships, setRelationships] = useState(initialRelationships);
  const [selectedClassId, setSelectedClassId] = useState(initialClasses[0].id);
  const [dragState, setDragState] = useState(null);
  const [selectedRelationshipType, setSelectedRelationshipType] = useState('association');
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const canvasRef = useRef(null);

  const generatedCode = useMemo(() => generateJavaCode(classes, relationships), [classes, relationships]);
  const selectedClass = classes.find((cls) => cls.id === selectedClassId) || null;

  const updateSelectedClass = (patch) => {
    setClasses((current) => current.map((cls) => cls.id === selectedClassId ? { ...cls, ...patch } : cls));
  };

  const addClass = () => {
    const id = `class-${Date.now()}`;
    const newClass = {
      id,
      name: `Class${classes.length + 1}`,
      x: 80 + (classes.length % 4) * 180,
      y: 80 + (classes.length % 3) * 140,
      fields: 'attribute: String',
      methods: 'method(): void'
    };
    setClasses((current) => [...current, newClass]);
    setSelectedClassId(id);
  };

  const deleteSelectedClass = () => {
    if (!selectedClassId) return;
    setClasses((current) => current.filter((item) => item.id !== selectedClassId));
    setRelationships((current) => current.filter((rel) => rel.sourceId !== selectedClassId && rel.targetId !== selectedClassId));
    const remaining = classes.filter((item) => item.id !== selectedClassId);
    if (remaining.length) setSelectedClassId(remaining[0].id);
  };

  const addRelationship = () => {
    if (!sourceId || !targetId || sourceId === targetId) return;

    const newRelation = {
      id: `rel-${Date.now()}`,
      type: selectedRelationshipType,
      sourceId,
      targetId
    };

    setRelationships((current) => [...current, newRelation]);
    setSourceId('');
    setTargetId('');
  };

  const removeRelationship = (id) => setRelationships((current) => current.filter((rel) => rel.id !== id));

  const handleMouseDown = (event, classId) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const source = classes.find((cls) => cls.id === classId);
    if (!source) return;

    setDragState({
      id: classId,
      offsetX: event.clientX - rect.left - source.x,
      offsetY: event.clientY - rect.top - source.y
    });
  };

  const handleMouseMove = (event) => {
    if (!dragState) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const nextX = event.clientX - rect.left - dragState.offsetX;
    const nextY = event.clientY - rect.top - dragState.offsetY;

    setClasses((current) => current.map((cls) => cls.id === dragState.id ? { ...cls, x: Math.max(10, nextX), y: Math.max(10, nextY) } : cls));
  };

  const handleMouseUp = () => setDragState(null);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      alert('Java source code copied to clipboard.');
    } catch (error) {
      alert('Copy failed. Please manually copy the generated code.');
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Design Studio</p>
          <h1>UML Class Diagram Generator</h1>
        </div>
        <div className="topbar-actions">
          <button className="primary-btn" onClick={addClass}>Add Class</button>
          <button className="secondary-btn" onClick={() => downloadJavaFile(generatedCode)}>Download Java</button>
          <button className="secondary-btn" onClick={copyCode}>Copy Code</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="panel control-panel">
          <h2>Class Editor</h2>
          {selectedClass ? (
            <>
              <label>
                Class Name
                <input value={selectedClass.name} onChange={(e) => updateSelectedClass({ name: e.target.value })} />
              </label>

              <label>
                Fields
                <textarea
                  rows={6}
                  value={selectedClass.fields}
                  onChange={(e) => updateSelectedClass({ fields: e.target.value })}
                />
              </label>

              <label>
                Methods
                <textarea
                  rows={6}
                  value={selectedClass.methods}
                  onChange={(e) => updateSelectedClass({ methods: e.target.value })}
                />
              </label>

              <button className="danger-btn" onClick={deleteSelectedClass}>Delete Class</button>
            </>
          ) : (
            <p>Select a class to edit.</p>
          )}

          <div className="relationship-builder">
            <h3>Relationship Builder</h3>
            <label>
              Relationship Type
              <select value={selectedRelationshipType} onChange={(e) => setSelectedRelationshipType(e.target.value)}>
                <option value="association">Association</option>
                <option value="generalization">Inheritance</option>
                <option value="composition">Composition</option>
                <option value="aggregation">Aggregation</option>
              </select>
            </label>

            <label>
              Source
              <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">Select source</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </label>

            <label>
              Target
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">Select target</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </label>

            <button className="primary-btn" onClick={addRelationship}>Add Relationship</button>
          </div>
        </aside>

        <main className="panel canvas-panel">
          <div
            className="diagram-canvas"
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <svg className="relationship-layer" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid meet">
              {relationships.map((rel) => {
                const source = classes.find((cls) => cls.id === rel.sourceId);
                const target = classes.find((cls) => cls.id === rel.targetId);
                if (!source || !target) return null;

                const x1 = source.x + 180;
                const y1 = source.y + 80;
                const x2 = target.x;
                const y2 = target.y + 80;
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                const markerId = `marker-${rel.id}`;

                return (
                  <g key={rel.id}>
                    <defs>
                      <marker id={markerId} markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                        <path d="M 0 0 L 12 6 L 0 12 z" fill="#1b2940" />
                      </marker>
                    </defs>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#1b2940"
                      strokeWidth={rel.type === 'generalization' ? 2.2 : 1.8}
                      markerEnd={rel.type === 'association' ? undefined : `url(#${markerId})`}
                      strokeDasharray={rel.type === 'aggregation' ? '8 5' : rel.type === 'composition' ? '2 8' : '0'}
                    />
                    <text x={midX} y={midY - 12} textAnchor="middle" fontSize="12" fill="#425466">
                      {rel.type}
                    </text>
                    <g onClick={() => removeRelationship(rel.id)} className="remove-relation" transform={`translate(${midX}, ${midY})`}>
                      <circle r="8" fill="#f87171" opacity="0.9" />
                      <text x="0" y="3" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">×</text>
                    </g>
                  </g>
                );
              })}
            </svg>

            {classes.map((cls) => (
              <div
                key={cls.id}
                className={`class-node ${selectedClassId === cls.id ? 'selected' : ''}`}
                style={{ left: cls.x, top: cls.y, width: 180 }}
                onMouseDown={(event) => handleMouseDown(event, cls.id)}
                onClick={() => setSelectedClassId(cls.id)}
              >
                <div className="class-header">{cls.name}</div>
                <div className="class-body">
                  {parseFields(cls.fields).map((field, index) => (
                    <div key={`${cls.id}-field-${index}`} className="class-line">
                      {field.name}: {field.type}
                    </div>
                  ))}
                </div>
                <div className="class-body bottom">
                  {parseMethods(cls.methods).map((method, index) => (
                    <div key={`${cls.id}-method-${index}`} className="class-line method-line">
                      {method.name}()
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>

        <aside className="panel code-panel">
          <h2>Generated Java Source</h2>
          <textarea readOnly value={generatedCode} rows={32} />
        </aside>
      </div>
    </div>
  );
}

export default App;
