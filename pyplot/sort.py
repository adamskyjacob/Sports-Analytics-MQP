import locale

if __name__ == "__main__":
    locale.setlocale(locale.LC_COLLATE, '')
    data = ["1-1", "2-1", "3-1", "CB-A-1", "1-2", "2-2", "3-2", "CB-A-2", "1-3", "2-3", "3-3", "CB-A-3"]
    mapped = []

    for d in data:
        split = d.rsplit("-", 1)
        pick_num = int(split[1])
        mapped.append()
        
    def pick_sort(item):
        key = 0
        split = item.rsplit("-", 1)
        pick_num = int(split[1])
        if split[0].isdigit():
            key += (int(split[0]) * 100) + pick_num
        else:
            key += 
            
        return key
        