import { useId } from 'react';
import type { ObjectView } from '../game/types';

export function ObjectIllustration({ object }: { object: ObjectView }) {
  const titleId = useId();
  const appearance: string =
    object.appearance ?? (object.form === 'lamp' ? 'reading' : object.form);
  const sampleCase = object.id === 'nora-sample-case';
  const sampleTray = object.casePresentation?.mode === 'stationary-tray';
  const sampleCatch = object.casePresentation?.catch ?? 'original';
  return (
    <div
      className={`object-art ${object.visual} ${appearance} ${object.form !== 'lamp' && object.form !== 'torch' ? 'crafted-object' : ''}`}
    >
      <svg viewBox="0 0 320 250" role="img" aria-labelledby={titleId}>
        <title id={titleId}>
          {object.title}: {object.condition}
        </title>
        <ellipse className="light-pool" cx="160" cy="216" rx="123" ry="23" />
        {appearance === 'reading' && (
          <>
            <path className="lamp-base" d="M106 216 Q149 196 197 212 L197 221 L106 221 Z" />
            <path className="lamp-stem" d="M151 206 L142 137 L189 88" />
            <circle className="joint" cx="142" cy="137" r="9" />
            <path className="lamp-shade" d="M176 65 Q207 66 222 90 L238 115 L172 127 L166 89 Z" />
            <path className="shade-rim" d="M172 127 L238 115" />
            <path className="pull" d="M125 216 C80 221 91 238 58 227" />
          </>
        )}
        {appearance === 'bedside' && (
          <>
            <path className="lamp-shade" d="M112 51 Q160 39 208 51 L229 119 Q160 137 91 119 Z" />
            <path className="shade-rim" d="M91 119 Q160 136 229 119" />
            <path
              className="ceramic-body"
              d="M146 132 L174 132 L176 158 C211 170 205 211 179 217 L141 217 C115 211 109 170 144 158 Z"
            />
            <path
              className="ceramic-mark"
              d="M138 176 Q160 187 181 177 M134 190 Q158 202 185 192"
            />
            <path className="pull" d="M195 133 L195 157" />
            <circle className="pull-tip" cx="195" cy="162" r="4" />
          </>
        )}
        {appearance === 'kitchen' && (
          <>
            <path className="handle" d="M132 73 L132 52 Q160 26 188 52 L188 73" />
            <path className="lamp-base" d="M121 76 L199 76 L210 209 L110 209 Z" />
            <path className="lamp-shade glass" d="M128 99 L192 99 L199 184 L121 184 Z" />
            <path className="shade-rim" d="M124 137 L196 137 M160 100 L160 183" />
            <path className="lamp-base" d="M109 209 L211 209 L211 221 L109 221 Z" />
            <circle className="pull-tip" cx="160" cy="87" r="5" />
          </>
        )}
        {appearance === 'torch' && (
          <>
            <path className="lamp-base" d="M74 144 L186 108 L207 172 L95 207 Q79 190 74 144 Z" />
            <path
              className="torch-grip"
              d="M103 145 L116 187 M120 140 L133 182 M137 135 L150 177"
            />
            <path className="lamp-shade" d="M183 105 L220 86 L250 177 L207 175 Z" />
            <path className="shade-rim" d="M224 97 L246 167" />
            <path className="pull" d="M79 177 C33 182 52 218 91 203" />
            <path className="torch-switch" d="M146 122 L167 116 L170 125 L149 131 Z" />
          </>
        )}
        {appearance === 'timer' && (
          <>
            <ellipse className="timer-foot" cx="160" cy="209" rx="67" ry="11" />
            <path
              className="timer-shell"
              d="M94 184 Q78 126 110 84 Q160 50 209 83 Q241 126 226 184 L213 207 L107 207 Z"
            />
            <circle className="timer-dial" cx="160" cy="142" r="58" />
            <circle className="timer-centre" cx="160" cy="142" r="38" />
            <g className="timer-marks">
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
                <path key={angle} transform={`rotate(${angle} 160 142)`} d="M160 90 L160 98" />
              ))}
            </g>
            <path className="timer-pointer" d="M160 142 L145 109 L153 108 L168 139 Z" />
            <circle className="timer-button" cx="160" cy="142" r="9" />
          </>
        )}
        {appearance === 'bell' && (
          <>
            <path
              className="bell-clamp"
              d="M127 173 L125 202 Q157 229 190 204 L189 176 M137 181 L137 197 Q157 214 178 198 L178 181"
            />
            <ellipse className="bell-base" cx="160" cy="175" rx="76" ry="17" />
            <path
              className="bell-dome"
              d="M87 169 Q90 90 157 87 Q225 84 234 167 Q162 195 87 169 Z"
            />
            <path className="bell-shine" d="M112 143 Q119 108 148 108" />
            <path className="bell-striker" d="M217 163 L242 142 L253 145 L239 166 L221 177" />
            <circle className="bell-screw" cx="156" cy="96" r="5" />
          </>
        )}
        {appearance === 'box' && !sampleCase && (
          <>
            <path className="box-side" d="M63 116 L90 93 L263 100 L259 203 L234 222 L61 213 Z" />
            <path className="box-lid" d="M63 116 L90 93 L263 100 L235 125 Z" />
            <path className="box-front" d="M63 116 L235 125 L234 222 L61 213 Z" />
            <path className="box-panel" d="M74 136 L224 143 L223 207 L73 201 Z" />
            <path className="box-catch" d="M145 124 L165 125 L165 151 L145 150 Z" />
            <path className="box-handle" d="M131 106 Q144 89 165 103" />
            <path className="box-thread" d="M86 154 Q105 177 93 195 M100 154 Q120 178 108 197" />
          </>
        )}
        {sampleCase && (
          <g className="sample-case-art">
            <path
              fill="#839080"
              stroke="#535f53"
              strokeWidth="2"
              d={
                sampleTray
                  ? 'M24 121 L66 84 L277 106 L236 143 Z'
                  : 'M48 119 L62 48 L279 55 L290 129 Z'
              }
            />
            <path
              fill="#b4b49b"
              d={
                sampleTray
                  ? 'M39 119 L70 94 L261 112 L234 134 Z'
                  : 'M64 110 L75 64 L266 70 L276 116 Z'
              }
            />
            <path
              fill="#737f6c"
              stroke="#515d50"
              strokeWidth="2"
              d="M32 153 L70 117 L288 139 L250 181 Z"
            />
            <path
              fill="#a5ae91"
              stroke="#535f53"
              strokeWidth="2"
              d="M32 153 L250 181 L250 213 L32 183 Z"
            />
            <path
              fill="#67745f"
              stroke="#535f53"
              strokeWidth="2"
              d="M250 181 L288 139 L288 172 L250 213 Z"
            />
            <path fill="#e2d7ba" d="M48 153 L77 128 L267 146 L240 172 Z" />
            <path fill="#b8a271" d="M60 150 L83 132 L114 136 L94 158 Z" />
            <path fill="#ae8580" d="M103 157 L124 138 L154 141 L132 161 Z" />
            <path fill="#7b9090" d="M141 162 L163 143 L193 147 L172 167 Z" />
            <path fill="#80916b" d="M181 167 L204 149 L231 152 L212 172 Z" />
            <path
              fill="none"
              stroke="#828a72"
              strokeWidth="3"
              d="M100 129 L74 162 M143 134 L117 168 M184 138 L159 173 M225 143 L200 179"
            />
            <g stroke="#706c55" strokeWidth="1.3" opacity="0.7">
              <path d="M84 145 l12 2 M127 150 l12 2 M168 155 l12 2 M209 160 l12 2" />
              <path d="M81 148 l9 1 M124 153 l9 1 M165 158 l9 1 M206 163 l9 1" />
            </g>
            {sampleCatch !== 'none' && (
              <>
                <path
                  fill={sampleCatch === 'compatible' ? '#c7b58a' : '#b7a478'}
                  stroke="#787052"
                  strokeWidth="1.4"
                  d="M138 170 L153 172 L153 198 L138 196 Z"
                />
                {sampleCatch === 'original' && (
                  <path stroke="#817958" strokeWidth="1.3" d="M142 181 l7 1 M143 188 l5 1" />
                )}
              </>
            )}
            <path fill="#d2c5a6" opacity="0.7" d="M50 165 L116 174 L115 190 L49 181 Z" />
            <text fill="#7d7862" fontSize="7" transform="translate(55 174) rotate(7)">
              SERVICE · COUNTER
            </text>
            <path
              fill="#d0c4a5"
              stroke="#9a9279"
              strokeWidth="1"
              d="M235 152 L261 149 L271 154 L245 158 Z"
            />
            {object.inspected && (
              <text fill="#655e49" fontSize="5.7" transform="translate(237 153) rotate(-5)">
                INTERCHANGEABLE
              </text>
            )}
          </g>
        )}
        {appearance === 'clip' && (
          <>
            <path className="clip-paper" d="M78 57 L243 66 L237 213 L70 204 Z" />
            <g className="paper-lines">
              <path d="M99 102 L215 108 M97 120 L213 126 M94 139 L211 145 M92 158 L210 164 M89 177 L207 183" />
              <path d="M128 96 L120 190 M177 99 L170 193" />
            </g>
            <path className="clip-body" d="M125 59 L192 63 L189 104 L122 99 Z" />
            <path
              className="clip-loop"
              d="M136 59 L133 31 Q159 8 185 34 L178 63 M141 61 L143 38 Q159 27 175 40 L174 63"
            />
            <path className="clip-fold" d="M121 100 L189 105 L188 112 L121 106 Z" />
          </>
        )}
        {appearance === 'model' && (
          <>
            <path className="model-base" d="M62 180 L119 145 L277 175 L223 220 L62 200 Z" />
            <path
              className="model-house"
              d="M87 127 L125 112 L151 124 L151 182 L111 196 L88 177 Z"
            />
            <path className="model-roof" d="M81 126 L106 99 L124 101 L155 120 L125 141 Z" />
            <path
              className="model-house"
              d="M160 116 L196 101 L225 114 L225 184 L183 199 L162 180 Z"
            />
            <path className="model-roof" d="M151 113 L179 84 L195 87 L231 112 L193 135 Z" />
            <g className="model-windows">
              <path d="M103 147 L114 152 L114 166 L103 161 Z M176 144 L188 150 L188 164 L176 158 Z M199 148 L210 145 L210 159 L199 163 Z" />
            </g>
            <path
              className="model-key"
              d="M249 191 L277 184 M270 179 Q288 165 288 181 Q288 198 272 191"
            />
          </>
        )}
      </svg>
    </div>
  );
}
