import type { Deed } from "../game";
import { deedText, pesos } from "../game";

/** The rent ladder and costs printed on a deed, as a table; railways and companies also say it in words. */
export function DeedDetails({ deed }: { readonly deed: Deed }) {
  const text = deedText(deed);
  if (deed.kind === "campo") {
    return (
      <table className="rent">
        <tbody>
          <tr>
            <th>Campo solo</th>
            <td>{pesos(deed.rent.campo)}</td>
          </tr>
          {deed.rent.chacras.map((rent, i) => (
            <tr key={i}>
              <th>
                {i + 1} {i === 0 ? "chacra" : "chacras"}
              </th>
              <td>{pesos(rent)}</td>
            </tr>
          ))}
          <tr>
            <th>Estancia</th>
            <td>{pesos(deed.rent.estancia)}</td>
          </tr>
          <tr className="sep">
            <th>Cada chacra</th>
            <td>{pesos(deed.chacraCost)}</td>
          </tr>
          <tr>
            <th>Estancia (más 4 chacras)</th>
            <td>{pesos(deed.estanciaCost)}</td>
          </tr>
          <tr>
            <th>Hipoteca</th>
            <td>{pesos(deed.mortgage)}</td>
          </tr>
        </tbody>
      </table>
    );
  }
  if (deed.kind === "ferrocarril") {
    return (
      <>
        <p className="deed-text">{text}</p>
        <table className="rent">
          <tbody>
            {deed.rentByCount.map((rent, i) => (
              <tr key={i}>
                <th>
                  Con {i + 1} {i === 0 ? "ferrocarril" : "ferrocarriles"}
                </th>
                <td>{pesos(rent)}</td>
              </tr>
            ))}
            <tr className="sep">
              <th>Hipoteca</th>
              <td>{pesos(deed.mortgage)}</td>
            </tr>
          </tbody>
        </table>
      </>
    );
  }
  return (
    <>
      <p className="deed-text">{text}</p>
      <table className="rent">
        <tbody>
          {deed.diceMultiplierByCount.map((mult, i) => (
            <tr key={i}>
              <th>
                Con {i + 1} {i === 0 ? "compañía" : "compañías"}
              </th>
              <td>dados × {mult}</td>
            </tr>
          ))}
          <tr className="sep">
            <th>Hipoteca</th>
            <td>{pesos(deed.mortgage)}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
