import datetime

def dias_restantes(data_plantio, ciclo_dias, hoje):
    fim_ciclo = data_plantio + datetime.timedelta(days=ciclo_dias)
    restante = (fim_ciclo - hoje).days
    return restante  # pode ser negativo: ciclo já passou do previsto


def _dias_desde_plantio(data_plantio, hoje):
    return (hoje - data_plantio).days


def fase_atual(data_plantio, fases, hoje):
    dias_passados = _dias_desde_plantio(data_plantio, hoje)
    for fase in fases:
        if fase['dia_inicio'] <= dias_passados <= fase['dia_fim']:
            return fase['nome']
    return None
