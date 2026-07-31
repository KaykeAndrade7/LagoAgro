from datetime import timedelta


def data_segura_colheita(aplicacoes):
    """
    aplicacoes: lista de dicts {"data": date, "carencia_dias": int}
    """
    if not aplicacoes:
        return None  # nenhuma aplicacao ainda = sem restricao de carencia

    # usa o MAIOR (data + carencia) entre todas as aplicacoes, nao so a mais
    # recente: uma aplicacao nova de carencia curta nao "apaga" a carencia
    # de uma aplicacao anterior que ainda esta ativa
    datas_seguras = [a["data"] + timedelta(days=a["carencia_dias"]) for a in aplicacoes]
    return max(datas_seguras)
