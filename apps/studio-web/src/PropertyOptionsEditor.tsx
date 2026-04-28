import { useState } from 'react';
import { TextInput, Select as MantineSelect, Checkbox as MantineCheckbox, Button } from '@mantine/core';

const PROPERTY_OPTIONS: Record<string, { key: string, label: string, type: string }[]> = {
  BaseProperty: [
    { key: 'defaultValue', label: 'Valeur par défaut', type: 'string' },
  ],
  StringProperty: [
    { key: 'minLength', label: 'Longueur Min', type: 'number' },
    { key: 'maxLength', label: 'Longueur Max', type: 'number' },
    { key: 'allowSpaces', label: 'Autoriser espaces', type: 'boolean' },
    { key: 'allowDigits', label: 'Autoriser chiffres', type: 'boolean' },
    { key: 'allowLetters', label: 'Autoriser lettres', type: 'boolean' },
    { key: 'allowPattern', label: 'Regex', type: 'string' },
  ],
  HashProperty: [
    { key: 'algorithm', label: 'Algorithme (md5, sha1, sha256)', type: 'string' },
    { key: 'salt', label: 'Sel', type: 'string' },
    { key: 'prefixed', label: 'Préfixé', type: 'boolean' },
  ],
  NumberProperty: [
    { key: 'minVal', label: 'Valeur Min', type: 'number' },
    { key: 'maxVal', label: 'Valeur Max', type: 'number' },
    { key: 'precision', label: 'Précision', type: 'number' },
  ],
  ArrayProperty: [
    { key: 'minLength', label: 'Nb éléments Min', type: 'number' },
    { key: 'maxLength', label: 'Nb éléments Max', type: 'number' },
    { key: 'allowNumbers', label: 'Autoriser nombres', type: 'boolean' },
    { key: 'allowStrings', label: 'Autoriser texte', type: 'boolean' },
  ],
  EnumProperty: [
    { key: 'enumLabels', label: 'Valeurs et libellés', type: 'keyValueList' },
  ],
  ObjectProperty: [],
  CollectionProperty: [
    { key: 'parentKey', label: 'Clé parente', type: 'string' },
  ],
  DateTimeProperty: [
    { key: 'timezone', label: 'Fuseau horaire', type: 'string' },
  ]
};

const getAvailableOptions = (propType: string) => {
  let opts = [...(PROPERTY_OPTIONS['BaseProperty'] || [])];
  if (propType === 'HashProperty') {
    opts = [...opts, ...(PROPERTY_OPTIONS['StringProperty'] || [])];
  }
  if (PROPERTY_OPTIONS[propType]) {
    opts = [...opts, ...PROPERTY_OPTIONS[propType]];
  }
  return opts;
};

export function PropertyOptionsEditor({ propType, options, onChange, models, inputStyle, disabled }: any) {
  const [selectedOptToAdd, setSelectedOptToAdd] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<any>('');

  const availableOpts = getAvailableOptions(propType);
  const activeKeys = Object.keys(options || {});
  
  // Options that can still be added
  const selectableOpts = availableOpts.filter(o => !activeKeys.includes(o.key));

  const handleAddOption = () => {
    if (selectedOptToAdd) {
      onChange({ ...options, [selectedOptToAdd]: tempValue });
      setSelectedOptToAdd(null);
      setTempValue('');
    }
  };

  const handleRemoveOption = (key: string) => {
    const newOpts = { ...options };
    delete newOpts[key];
    onChange(newOpts);
  };

  const handleChangeOption = (key: string, value: any) => {
    const newOptions = { ...options, [key]: value };
    // Auto-sync 'values' array if enumLabels are changed for EnumProperty
    if (propType === 'EnumProperty' && key === 'enumLabels') {
      newOptions.values = Object.keys(value || {});
    }
    onChange(newOptions);
  };

  if (!propType) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', padding: '15px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
      <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-main)' }}>Options ({propType})</span>
      
      {/* Active Options */}
      {activeKeys.map(key => {
        const optDef = availableOpts.find(o => o.key === key);
        if (!optDef) return null; // unknown option

        return (
          <div key={key} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              {optDef.type === 'string' && (
                <TextInput placeholder={optDef.label} value={options[key]} onChange={e => handleChangeOption(key, e.target.value)} styles={{ input: inputStyle }} disabled={disabled} />
              )}
              {optDef.type === 'number' && (
                <TextInput type="number" placeholder={optDef.label} value={options[key]} onChange={e => handleChangeOption(key, parseFloat(e.target.value))} styles={{ input: inputStyle }} disabled={disabled} />
              )}
              {optDef.type === 'boolean' && (
                <MantineCheckbox label={optDef.label} checked={!!options[key]} onChange={e => handleChangeOption(key, e.currentTarget.checked)} color="teal" disabled={disabled} />
              )}
              {optDef.type === 'model' && (
                <MantineSelect 
                  placeholder={optDef.label}
                  data={models.map((m: any) => ({ value: m.uid, label: m.name }))}
                  value={options[key]}
                  onChange={v => handleChangeOption(key, v)}
                  styles={{ input: inputStyle }}
                  disabled={disabled}
                />
              )}
              {optDef.type === 'array' && (
                <TextInput 
                  placeholder={optDef.label} 
                  value={Array.isArray(options[key]) ? options[key].join(', ') : options[key]} 
                  onChange={e => handleChangeOption(key, e.target.value.split(',').map(s => s.trim()))} 
                  styles={{ input: inputStyle }} 
                  disabled={disabled}
                />
              )}
              {optDef.type === 'keyValueList' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {Object.entries(options[key] || {}).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', gap: '5px' }}>
                      <TextInput value={k} disabled styles={{ input: { ...inputStyle, width: '100px', backgroundColor: 'transparent' } }} />
                      <TextInput 
                        value={v as string} 
                        onChange={e => handleChangeOption(key, { ...options[key], [k]: e.target.value })} 
                        styles={{ input: inputStyle }} 
                        disabled={disabled} 
                        placeholder="Libellé" 
                      />
                      {!disabled && (
                        <Button variant="subtle" color="red" size="xs" onClick={() => {
                          const newObj = { ...options[key] };
                          delete newObj[k];
                          handleChangeOption(key, newObj);
                        }}>✖</Button>
                      )}
                    </div>
                  ))}
                  {!disabled && (
                    <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                      <TextInput id={`new_key_${key}`} placeholder="Nouvelle clé (ex: FR)" styles={{ input: inputStyle }} style={{ width: '100px' }} />
                      <TextInput id={`new_val_${key}`} placeholder="Libellé (ex: France)" styles={{ input: inputStyle }} />
                      <Button variant="light" color="teal" onClick={() => {
                        const keyInput = document.getElementById(`new_key_${key}`) as HTMLInputElement;
                        const valInput = document.getElementById(`new_val_${key}`) as HTMLInputElement;
                        if (keyInput.value && valInput.value) {
                          handleChangeOption(key, { ...(options[key] || {}), [keyInput.value]: valInput.value });
                          keyInput.value = '';
                          valInput.value = '';
                        }
                      }}>Ajouter</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {!disabled && (
              <button type="button" onClick={() => handleRemoveOption(key)} style={{ background: 'rgba(255,0,0,0.2)', color: '#ff6b6b', border: 'none', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer' }} title="Supprimer l'option">✖</button>
            )}
          </div>
        );
      })}

      {/* Add new option selector */}
      {(!disabled && selectableOpts.length > 0) && (() => {
        const selectedOptDef = selectableOpts.find(o => o.key === selectedOptToAdd);
        return (
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <MantineSelect 
              placeholder="Ajouter un paramètre facultatif..."
              data={selectableOpts.map(o => ({ value: o.key, label: o.label }))}
              value={selectedOptToAdd}
              onChange={(val) => {
                setSelectedOptToAdd(val);
                setTempValue('');
              }}
              styles={{ input: inputStyle, root: { flex: 1 } }}
            />
            
            {selectedOptToAdd && selectedOptDef && (
              <div style={{ flex: 1 }}>
                {selectedOptDef.type === 'string' && (
                  <TextInput placeholder={selectedOptDef.label} value={tempValue} onChange={e => setTempValue(e.target.value)} styles={{ input: inputStyle }} />
                )}
                {selectedOptDef.type === 'number' && (
                  <TextInput type="number" placeholder={selectedOptDef.label} value={tempValue} onChange={e => setTempValue(parseFloat(e.target.value))} styles={{ input: inputStyle }} />
                )}
                {selectedOptDef.type === 'boolean' && (
                  <MantineCheckbox label={selectedOptDef.label} checked={!!tempValue} onChange={e => setTempValue(e.currentTarget.checked)} color="teal" />
                )}
                {selectedOptDef.type === 'model' && (
                  <MantineSelect 
                    placeholder={selectedOptDef.label}
                    data={models.map((m: any) => ({ value: m.uid, label: m.name }))}
                    value={tempValue}
                    onChange={v => setTempValue(v)}
                    styles={{ input: inputStyle }}
                  />
                )}
                {selectedOptDef.type === 'array' && (
                  <TextInput 
                    placeholder={selectedOptDef.label} 
                    value={Array.isArray(tempValue) ? tempValue.join(', ') : tempValue} 
                    onChange={e => setTempValue(e.target.value.split(',').map(s => s.trim()))} 
                    styles={{ input: inputStyle }} 
                  />
                )}
                {selectedOptDef.type === 'keyValueList' && (
                  <span style={{ fontSize: '13px', color: 'var(--mantine-color-dimmed)' }}>Cliquez sur Ajouter pour commencer la saisie</span>
                )}
              </div>
            )}
            
            <Button type="button" color="teal" variant="light" onClick={handleAddOption} disabled={!selectedOptToAdd}>Ajouter</Button>
          </div>
        );
      })()}
    </div>
  );
}
